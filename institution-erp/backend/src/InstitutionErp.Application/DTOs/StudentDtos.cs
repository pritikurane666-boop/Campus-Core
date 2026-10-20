using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Application.DTOs;

public class StudentDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string StudentRegistrationNumber { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string BloodGroup { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public StudentStatus Status { get; set; }
    public DateTime AdmissionDate { get; set; }
    public Guid ClassRoomId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string? GuardianName { get; set; }
    public string? GuardianPhone { get; set; }
    public string? GuardianEmail { get; set; }
    public string? GeneratedPassword { get; set; }
}

public class CreateStudentResponse : StudentDto
{
    public CredentialSlipDto? CredentialSlip { get; set; }
    public string? TemporaryPassword => CredentialSlip?.TemporaryPassword;
}


public record CreateStudentRequest(
    string FirstName,
    string LastName,
    string Email,
    string? PhoneNumber,
    string? Password,
    string RollNumber,
    DateTime DateOfBirth,
    Gender Gender,
    string BloodGroup,
    string Address,
    Guid ClassRoomId,
    DateTime AdmissionDate,
    string? GuardianName,
    string? GuardianPhone,
    string? GuardianEmail,
    string? GuardianRelation
);

public record UpdateStudentRequest(
    string FirstName,
    string LastName,
    string? PhoneNumber,
    string RollNumber,
    DateTime DateOfBirth,
    Gender Gender,
    string BloodGroup,
    string Address,
    Guid ClassRoomId,
    StudentStatus Status,
    string? Email = null,
    string? GuardianName = null,
    string? GuardianPhone = null,
    string? GuardianEmail = null,
    string? GuardianRelation = null
);

public class ParentDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string Occupation { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public List<StudentDto> LinkedStudents { get; set; } = new();
}

public record ResetStudentPasswordRequest(string? NewPassword = null);

