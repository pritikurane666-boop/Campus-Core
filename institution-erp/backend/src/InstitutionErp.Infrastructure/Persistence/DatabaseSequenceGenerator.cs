using System.Data;
using Microsoft.EntityFrameworkCore;
using InstitutionErp.Application.Common.Interfaces;

namespace InstitutionErp.Infrastructure.Persistence;

public class DatabaseSequenceGenerator : ISequenceGenerator
{
    private readonly ApplicationDbContext _db;
    private static int _inMemoryStudentSeq = 0;
    private static int _inMemoryAdmissionSeq = 0;
    private static int _inMemoryReceiptSeq = 0;
    private static int _inMemoryTeacherSeq = 0;
    private static bool _sequencesInitialized = false;
    private static readonly object _initLock = new();

    public DatabaseSequenceGenerator(ApplicationDbContext db)
    {
        _db = db;
    }

    private async Task EnsurePostgreSqlSequencesAsync(CancellationToken cancellationToken)
    {
        if (_sequencesInitialized || !_db.Database.IsRelational()) return;

        lock (_initLock)
        {
            if (_sequencesInitialized) return;
        }

        try
        {
            var initSql = @"
                CREATE SEQUENCE IF NOT EXISTS student_registration_seq START WITH 1;
                CREATE SEQUENCE IF NOT EXISTS admission_reference_seq START WITH 1;
                CREATE SEQUENCE IF NOT EXISTS fee_receipt_seq START WITH 1;
                CREATE SEQUENCE IF NOT EXISTS teacher_employee_seq START WITH 1;
            ";
            await _db.Database.ExecuteSqlRawAsync(initSql, cancellationToken);
            _sequencesInitialized = true;
        }
        catch
        {
            // Non-critical if user lacks DDL or concurrent execution
        }
    }

    public async Task<string> NextStudentRegistrationNumberAsync(CancellationToken cancellationToken = default)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"{year}-CLS-";

        if (_db.Database.IsRelational())
        {
            await EnsurePostgreSqlSequencesAsync(cancellationToken);
            try
            {
                var connection = _db.Database.GetDbConnection();
                if (connection.State != ConnectionState.Open)
                {
                    await connection.OpenAsync(cancellationToken);
                }

                using var cmd = connection.CreateCommand();
                cmd.CommandText = "SELECT nextval('student_registration_seq');";
                var result = await cmd.ExecuteScalarAsync(cancellationToken);
                var val = Convert.ToInt64(result);

                var candidate = $"{prefix}{val:D4}";
                // Guarantee uniqueness if legacy unsequenced records existed
                while (await _db.Students.IgnoreQueryFilters().AnyAsync(s => s.StudentRegistrationNumber == candidate, cancellationToken))
                {
                    using var nextCmd = connection.CreateCommand();
                    nextCmd.CommandText = "SELECT nextval('student_registration_seq');";
                    val = Convert.ToInt64(await nextCmd.ExecuteScalarAsync(cancellationToken));
                    candidate = $"{prefix}{val:D4}";
                }

                return candidate;
            }
            catch
            {
                // Fallback to in-memory/table scan if sequence call fails
            }
        }

        // In-memory or fallback generator
        var seq = Interlocked.Increment(ref _inMemoryStudentSeq);
        var regNo = $"{prefix}{seq:D4}";
        while (await _db.Students.IgnoreQueryFilters().AnyAsync(s => s.StudentRegistrationNumber == regNo, cancellationToken))
        {
            seq = Interlocked.Increment(ref _inMemoryStudentSeq);
            regNo = $"{prefix}{seq:D4}";
        }
        return regNo;
    }

    public async Task<string> NextAdmissionReferenceNumberAsync(CancellationToken cancellationToken = default)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"ADM-{year}-";

        if (_db.Database.IsRelational())
        {
            await EnsurePostgreSqlSequencesAsync(cancellationToken);
            try
            {
                var connection = _db.Database.GetDbConnection();
                if (connection.State != ConnectionState.Open)
                {
                    await connection.OpenAsync(cancellationToken);
                }

                using var cmd = connection.CreateCommand();
                cmd.CommandText = "SELECT nextval('admission_reference_seq');";
                var result = await cmd.ExecuteScalarAsync(cancellationToken);
                var val = Convert.ToInt64(result);

                var candidate = $"{prefix}{val:D4}";
                while (await _db.Admissions.IgnoreQueryFilters().AnyAsync(a => a.ReferenceNumber == candidate, cancellationToken))
                {
                    using var nextCmd = connection.CreateCommand();
                    nextCmd.CommandText = "SELECT nextval('admission_reference_seq');";
                    val = Convert.ToInt64(await nextCmd.ExecuteScalarAsync(cancellationToken));
                    candidate = $"{prefix}{val:D4}";
                }

                return candidate;
            }
            catch
            {
                // Fallback to in-memory/table scan if sequence call fails
            }
        }

        var seq = Interlocked.Increment(ref _inMemoryAdmissionSeq);
        var refNo = $"{prefix}{seq:D4}";
        while (await _db.Admissions.IgnoreQueryFilters().AnyAsync(a => a.ReferenceNumber == refNo, cancellationToken))
        {
            seq = Interlocked.Increment(ref _inMemoryAdmissionSeq);
            refNo = $"{prefix}{seq:D4}";
        }
        return refNo;
    }

    public async Task<string> NextFeeReceiptNumberAsync(CancellationToken cancellationToken = default)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"REC-{year}-";

        if (_db.Database.IsRelational())
        {
            await EnsurePostgreSqlSequencesAsync(cancellationToken);
            try
            {
                var connection = _db.Database.GetDbConnection();
                if (connection.State != ConnectionState.Open)
                {
                    await connection.OpenAsync(cancellationToken);
                }

                using var cmd = connection.CreateCommand();
                cmd.CommandText = "SELECT nextval('fee_receipt_seq');";
                var result = await cmd.ExecuteScalarAsync(cancellationToken);
                var val = Convert.ToInt64(result);

                return $"{prefix}{val:D4}";
            }
            catch
            {
                // Fallback
            }
        }

        var seq = Interlocked.Increment(ref _inMemoryReceiptSeq);
        return $"{prefix}{seq:D4}";
    }

    public async Task<string> NextTeacherEmployeeCodeAsync(CancellationToken cancellationToken = default)
    {
        var prefix = "TCH-";

        if (_db.Database.IsRelational())
        {
            await EnsurePostgreSqlSequencesAsync(cancellationToken);
            try
            {
                var connection = _db.Database.GetDbConnection();
                if (connection.State != ConnectionState.Open)
                {
                    await connection.OpenAsync(cancellationToken);
                }

                using var cmd = connection.CreateCommand();
                cmd.CommandText = "SELECT nextval('teacher_employee_seq');";
                var result = await cmd.ExecuteScalarAsync(cancellationToken);
                var val = Convert.ToInt64(result);

                var candidate = $"{prefix}{val:D3}";
                while (await _db.Teachers.IgnoreQueryFilters().AnyAsync(t => t.EmployeeCode == candidate, cancellationToken))
                {
                    using var nextCmd = connection.CreateCommand();
                    nextCmd.CommandText = "SELECT nextval('teacher_employee_seq');";
                    val = Convert.ToInt64(await nextCmd.ExecuteScalarAsync(cancellationToken));
                    candidate = $"{prefix}{val:D3}";
                }

                return candidate;
            }
            catch
            {
                // Fallback to in-memory/table scan if sequence call fails
            }
        }

        var seq = Interlocked.Increment(ref _inMemoryTeacherSeq);
        var code = $"{prefix}{seq:D3}";
        while (await _db.Teachers.IgnoreQueryFilters().AnyAsync(t => t.EmployeeCode == code, cancellationToken))
        {
            seq = Interlocked.Increment(ref _inMemoryTeacherSeq);
            code = $"{prefix}{seq:D3}";
        }
        return code;
    }
}
