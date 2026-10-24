using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Infrastructure.Seeding;

public class DatabaseSeeder
{
    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly AdminOptions _adminOptions;
    private readonly ILogger<DatabaseSeeder> _logger;

    public DatabaseSeeder(
        ApplicationDbContext db,
        IPasswordHasher passwordHasher,
        IOptions<AdminOptions> adminOptions,
        ILogger<DatabaseSeeder> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _adminOptions = adminOptions.Value;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        // 0. Ensure existing "Principal" role is renamed to "HOD" to preserve user role bindings
        var existingPrincipalRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Principal");
        if (existingPrincipalRole != null)
        {
            var existingHodRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "HOD");
            if (existingHodRole == null)
            {
                existingPrincipalRole.Name = "HOD";
                existingPrincipalRole.Description = "HOD role with specific operational permissions.";
                await _db.SaveChangesAsync();
            }
        }

        // 1. Roles - Ensure canonical RBAC Roles exist
        var roleNames = Enum.GetNames<UserRoleType>();
        foreach (var roleName in roleNames)
        {
            if (!await _db.Roles.AnyAsync(r => r.Name == roleName))
            {
                _db.Roles.Add(new Role
                {
                    Name = roleName,
                    Description = $"{roleName} role with specific operational permissions."
                });
            }
        }
        await _db.SaveChangesAsync();

        var roles = await _db.Roles.ToDictionaryAsync(r => r.Name);
        var hodRoleId = roles[UserRoleType.HOD.ToString()].Id;

        // 2. Administrator Account Bootstrap (only if no HOD exists)
        var anyHodExists = await _db.UserRoles
            .AnyAsync(ur => ur.RoleId == hodRoleId && !ur.User.IsDeleted);

        if (!anyHodExists)
        {
            var adminEmail = _adminOptions.Email.Trim();
            var adminPassword = _adminOptions.Password?.Trim();

            if (string.IsNullOrWhiteSpace(adminPassword))
            {
                _logger.LogWarning("Admin bootstrap password is not configured. Skipping initial administrator creation.");
            }
            else
            {
                var existingUserByEmail = await _db.Users
                    .IgnoreQueryFilters()
                    .Include(u => u.UserRoles)
                    .FirstOrDefaultAsync(u => u.Email.ToLower() == adminEmail.ToLower());

                if (existingUserByEmail == null)
                {
                    var adminUser = new User
                    {
                        Email = adminEmail,
                        FirstName = "System",
                        LastName = "Administrator",
                        PasswordHash = _passwordHasher.HashPassword(adminPassword),
                        PhoneNumber = "+1 000-000-0000",
                        IsActive = true,
                        IsDeleted = false
                    };
                    adminUser.UserRoles.Add(new UserRole { RoleId = hodRoleId });
                    _db.Users.Add(adminUser);
                    await _db.SaveChangesAsync();
                    _logger.LogInformation("Initial HOD administrator account created: {Email}", adminEmail);
                }
                else
                {
                    // User exists by email, attach HOD role if missing without overwriting password
                    existingUserByEmail.IsDeleted = false;
                    existingUserByEmail.IsActive = true;
                    if (!existingUserByEmail.UserRoles.Any(ur => ur.RoleId == hodRoleId))
                    {
                        existingUserByEmail.UserRoles.Add(new UserRole { RoleId = hodRoleId, UserId = existingUserByEmail.Id });
                        await _db.SaveChangesAsync();
                        _logger.LogInformation("Assigned HOD role to existing user: {Email}", adminEmail);
                    }
                }
            }
        }
        else
        {
            _logger.LogInformation("Administrator account already exists. Password preservation active (no overwrite).");
        }

        // 3. Standard Grade Scales (System reference metrics)
        if (!await _db.GradeScales.AnyAsync())
        {
            _db.GradeScales.AddRange(
                new GradeScale { GradeLetter = "A+", MinPercentage = 90, MaxPercentage = 100, GradePoint = 10.0m, Description = "Outstanding" },
                new GradeScale { GradeLetter = "A", MinPercentage = 80, MaxPercentage = 89.99m, GradePoint = 9.0m, Description = "Excellent" },
                new GradeScale { GradeLetter = "B+", MinPercentage = 70, MaxPercentage = 79.99m, GradePoint = 8.0m, Description = "Very Good" },
                new GradeScale { GradeLetter = "B", MinPercentage = 60, MaxPercentage = 69.99m, GradePoint = 7.0m, Description = "Good" },
                new GradeScale { GradeLetter = "C", MinPercentage = 50, MaxPercentage = 59.99m, GradePoint = 6.0m, Description = "Satisfactory" },
                new GradeScale { GradeLetter = "D", MinPercentage = 35, MaxPercentage = 49.99m, GradePoint = 4.0m, Description = "Pass" },
                new GradeScale { GradeLetter = "F", MinPercentage = 0, MaxPercentage = 34.99m, GradePoint = 0.0m, Description = "Fail" }
            );
            await _db.SaveChangesAsync();
        }
    }
}
