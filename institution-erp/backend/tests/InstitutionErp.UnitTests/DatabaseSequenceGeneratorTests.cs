using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.UnitTests;

public class DatabaseSequenceGeneratorTests
{
    private ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task NextStudentRegistrationNumberAsync_ReturnsValidFormattedSequence()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var generator = new DatabaseSequenceGenerator(db);
        var currentYear = DateTime.UtcNow.Year;

        // Act
        var reg1 = await generator.NextStudentRegistrationNumberAsync();
        var reg2 = await generator.NextStudentRegistrationNumberAsync();

        // Assert
        reg1.Should().StartWith($"{currentYear}-CLS-");
        reg2.Should().StartWith($"{currentYear}-CLS-");
        reg1.Should().NotBe(reg2);
    }

    [Fact]
    public async Task NextAdmissionReferenceNumberAsync_ReturnsValidFormattedSequence()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var generator = new DatabaseSequenceGenerator(db);
        var currentYear = DateTime.UtcNow.Year;

        // Act
        var adm1 = await generator.NextAdmissionReferenceNumberAsync();
        var adm2 = await generator.NextAdmissionReferenceNumberAsync();

        // Assert
        adm1.Should().StartWith($"ADM-{currentYear}-");
        adm2.Should().StartWith($"ADM-{currentYear}-");
        adm1.Should().NotBe(adm2);
    }

    [Fact]
    public async Task NextFeeReceiptNumberAsync_ReturnsValidFormattedSequence()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var generator = new DatabaseSequenceGenerator(db);
        var currentYear = DateTime.UtcNow.Year;

        // Act
        var rec1 = await generator.NextFeeReceiptNumberAsync();
        var rec2 = await generator.NextFeeReceiptNumberAsync();

        // Assert
        rec1.Should().StartWith($"REC-{currentYear}-");
        rec2.Should().StartWith($"REC-{currentYear}-");
        rec1.Should().NotBe(rec2);
    }

    [Fact]
    public async Task NextTeacherEmployeeCodeAsync_ReturnsValidFormattedSequence()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var generator = new DatabaseSequenceGenerator(db);

        // Act
        var code1 = await generator.NextTeacherEmployeeCodeAsync();
        var code2 = await generator.NextTeacherEmployeeCodeAsync();

        // Assert
        code1.Should().StartWith("TCH-");
        code2.Should().StartWith("TCH-");
        code1.Should().NotBe(code2);
    }

    [Fact]
    public async Task NextStudentRegistrationNumberAsync_AvoidsCollisionsWithExistingStudents()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var generator = new DatabaseSequenceGenerator(db);
        var currentYear = DateTime.UtcNow.Year;

        // Pre-populate student with next potential registration number
        var candidateReg = await generator.NextStudentRegistrationNumberAsync();
        db.Students.Add(new Student
        {
            StudentRegistrationNumber = candidateReg,
            RollNumber = "101",
            ClassRoomId = Guid.NewGuid(),
            UserId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        // Act
        var nextReg = await generator.NextStudentRegistrationNumberAsync();

        // Assert
        nextReg.Should().NotBe(candidateReg);
        nextReg.Should().StartWith($"{currentYear}-CLS-");
    }

    [Fact]
    public async Task ConcurrentGenerations_ProduceCompletelyUniqueIdentifiers()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var generator = new DatabaseSequenceGenerator(db);

        // Act - 50 concurrent requests
        var tasks = Enumerable.Range(0, 50)
            .Select(_ => generator.NextStudentRegistrationNumberAsync());
        var results = await Task.WhenAll(tasks);

        // Assert
        results.Distinct().Count().Should().Be(50);
    }
}
