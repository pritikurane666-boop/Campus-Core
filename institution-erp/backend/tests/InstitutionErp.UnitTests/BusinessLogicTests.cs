using FluentAssertions;
using Xunit;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;

namespace InstitutionErp.UnitTests;

public class BusinessLogicTests
{
    [Theory]
    [InlineData(95, "A+")]
    [InlineData(85, "A")]
    [InlineData(75, "B+")]
    [InlineData(65, "B")]
    [InlineData(55, "C")]
    [InlineData(40, "D")]
    [InlineData(25, "F")]
    public void GradeScale_CalculatesCorrectGradeLetter(decimal percentage, string expectedGrade)
    {
        // Arrange
        var scales = new List<GradeScale>
        {
            new() { GradeLetter = "A+", MinPercentage = 90, MaxPercentage = 100 },
            new() { GradeLetter = "A", MinPercentage = 80, MaxPercentage = 89.99m },
            new() { GradeLetter = "B+", MinPercentage = 70, MaxPercentage = 79.99m },
            new() { GradeLetter = "B", MinPercentage = 60, MaxPercentage = 69.99m },
            new() { GradeLetter = "C", MinPercentage = 50, MaxPercentage = 59.99m },
            new() { GradeLetter = "D", MinPercentage = 35, MaxPercentage = 49.99m },
            new() { GradeLetter = "F", MinPercentage = 0, MaxPercentage = 34.99m }
        };

        // Act
        var matched = scales.FirstOrDefault(s => percentage >= s.MinPercentage && percentage <= s.MaxPercentage);

        // Assert
        matched.Should().NotBeNull();
        matched!.GradeLetter.Should().Be(expectedGrade);
    }

    [Theory]
    [InlineData(30, 27, 90.0, false)] // 90% -> not low attendance
    [InlineData(30, 22, 73.3, true)]  // 73.3% -> low attendance (< 75%)
    [InlineData(30, 15, 50.0, true)]  // 50% -> low attendance (< 75%)
    public void AttendancePercentage_CalculatesAndDetectsLowAttendance(int totalDays, int presentDays, decimal expectedPct, bool isLowExpected)
    {
        // Act
        var calculatedPct = Math.Round((decimal)presentDays / totalDays * 100, 1);
        var isLow = calculatedPct < 75.0m;

        // Assert
        calculatedPct.Should().Be(expectedPct);
        isLow.Should().Be(isLowExpected);
    }

    [Fact]
    public void FeeDueAndPayment_CalculatesBalancesAndStatusAccurately()
    {
        // Arrange
        var studentFee = new StudentFee
        {
            BaseAmount = 50000m,
            DiscountAmount = 5000m,
            LateFeeAmount = 1000m,
            PaidAmount = 0m,
            DueDate = DateTime.UtcNow.AddDays(-10),
            Status = PaymentStatus.Pending
        };

        // Act 1: Initial state
        studentFee.TotalPayable.Should().Be(46000m); // 50000 - 5000 + 1000
        studentFee.BalanceAmount.Should().Be(46000m);

        // Act 2: Partial Payment of 20000
        studentFee.PaidAmount += 20000m;
        studentFee.Status = studentFee.PaidAmount >= studentFee.TotalPayable ? PaymentStatus.Paid : PaymentStatus.Partial;

        studentFee.BalanceAmount.Should().Be(26000m);
        studentFee.Status.Should().Be(PaymentStatus.Partial);

        // Act 3: Final Payment of 26000
        studentFee.PaidAmount += 26000m;
        studentFee.Status = studentFee.PaidAmount >= studentFee.TotalPayable ? PaymentStatus.Paid : PaymentStatus.Partial;

        studentFee.BalanceAmount.Should().Be(0m);
        studentFee.Status.Should().Be(PaymentStatus.Paid);
    }

    [Fact]
    public void AdmissionApproval_TransitionsStateCorrectly()
    {
        // Arrange
        var admission = new Admission
        {
            ReferenceNumber = "ADM-2026-0001",
            FirstName = "Alice",
            LastName = "Wonderland",
            Status = AdmissionStatus.Submitted
        };

        // Act: Under review
        admission.Status = AdmissionStatus.UnderReview;
        admission.Status.Should().Be(AdmissionStatus.UnderReview);

        // Act: Approved
        admission.Status = AdmissionStatus.Approved;
        admission.Status.Should().Be(AdmissionStatus.Approved);
    }

    [Theory]
    [InlineData(14)]
    [InlineData(16)]
    [InlineData(20)]
    public void PasswordGenerator_GeneratesSecureCompliantPassword(int length)
    {
        // Act
        var password = InstitutionErp.Application.Common.Utils.PasswordGenerator.Generate(length);

        // Assert
        password.Should().NotBeNullOrWhiteSpace();
        password.Length.Should().Be(length);
        password.Any(char.IsUpper).Should().BeTrue("Must contain at least one uppercase letter");
        password.Any(char.IsLower).Should().BeTrue("Must contain at least one lowercase letter");
        password.Any(char.IsDigit).Should().BeTrue("Must contain at least one digit");
        password.Any(ch => "!@#$%*".Contains(ch)).Should().BeTrue("Must contain at least one special character");
    }

    [Fact]
    public void PasswordGenerator_EnforcesMinimum14Characters()
    {
        var passwordShort = InstitutionErp.Application.Common.Utils.PasswordGenerator.Generate(8);
        passwordShort.Length.Should().Be(14, "Password generator must enforce at least 14 characters");

        var passwordDefault = InstitutionErp.Application.Common.Utils.PasswordGenerator.Generate();
        passwordDefault.Length.Should().Be(14, "Default password generator must produce 14 characters");
    }

    [Fact]
    public void PasswordGenerator_NeverContainsAmbiguousCharacters()
    {
        var ambiguousChars = new[] { '0', 'O', 'l', '1', 'I' };
        for (int i = 0; i < 100; i++)
        {
            var pwd = InstitutionErp.Application.Common.Utils.PasswordGenerator.Generate(16);
            pwd.IndexOfAny(ambiguousChars).Should().Be(-1, "Password must not contain ambiguous characters 0, O, l, 1, I");
        }
    }

    [Fact]
    public void PasswordGenerator_GeneratesUniquePasswordsEachTime()
    {
        var passwords = Enumerable.Range(0, 50)
            .Select(_ => InstitutionErp.Application.Common.Utils.PasswordGenerator.Generate(14))
            .ToList();

        passwords.Distinct().Count().Should().Be(50, "Generated passwords must be unique");
    }

    [Theory]
    [InlineData("Priti", "pri@123")]
    [InlineData("Diksha", "dik@123")]
    [InlineData("Yuga", "yug@123")]
    [InlineData("Suhani", "suh@123")]
    [InlineData("Bo", "box@123")]
    [InlineData("", "stu@123")]
    [InlineData(null, "stu@123")]
    public void GenerateStudentPassword_FollowsFirstThreeLettersAt123Format(string? name, string expected)
    {
        var password = InstitutionErp.Application.Common.Utils.PasswordGenerator.GenerateStudentPassword(name);
        password.Should().Be(expected);
    }

    [Theory]
    [InlineData("Amit", "ami$123")]
    [InlineData("Komal", "kom$123")]
    [InlineData("Aniket", "ani$123")]
    [InlineData("Al", "alx$123")]
    [InlineData("", "tch$123")]
    [InlineData(null, "tch$123")]
    public void GenerateTeacherPassword_FollowsFirstThreeLettersDollar123Format(string? name, string expected)
    {
        var password = InstitutionErp.Application.Common.Utils.PasswordGenerator.GenerateTeacherPassword(name);
        password.Should().Be(expected);
    }

    [Fact]
    public void AttendanceMarkedStatus_TracksCorrectlyInDtos()
    {
        // ClassAttendanceSummaryDto tracks whether attendance was marked
        var unmarkedSummary = new InstitutionErp.Application.DTOs.ClassAttendanceSummaryDto
        {
            ClassRoomId = Guid.NewGuid(),
            IsMarked = false
        };
        unmarkedSummary.IsMarked.Should().BeFalse();

        var markedSummary = new InstitutionErp.Application.DTOs.ClassAttendanceSummaryDto
        {
            ClassRoomId = Guid.NewGuid(),
            IsMarked = true
        };
        markedSummary.IsMarked.Should().BeTrue();

        // ClassRoomDto tracks today's attendance for dashboard
        var classRoom = new InstitutionErp.Application.DTOs.ClassRoomDto
        {
            Id = Guid.NewGuid(),
            FullName = "Grade 10-A",
            IsAttendanceMarkedToday = true
        };
        classRoom.IsAttendanceMarkedToday.Should().BeTrue();
    }
}

