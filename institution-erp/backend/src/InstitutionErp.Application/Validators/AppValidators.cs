using FluentValidation;
using InstitutionErp.Application.DTOs;

namespace InstitutionErp.Application.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Email, Student ID, or Employee Code is required.");
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6);
    }
}

public class ApplyAdmissionRequestValidator : AbstractValidator<ApplyAdmissionRequest>
{
    public ApplyAdmissionRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.PhoneNumber).NotEmpty().MinimumLength(10);
        RuleFor(x => x.GuardianName).NotEmpty();
        RuleFor(x => x.GuardianPhone).NotEmpty();
        RuleFor(x => x.DesiredClassRoomId).NotEmpty();
        RuleFor(x => x.PreviousSchoolPercentage).InclusiveBetween(0, 100);
    }
}

public class CreateStudentRequestValidator : AbstractValidator<CreateStudentRequest>
{
    public CreateStudentRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.RollNumber).NotEmpty();
        RuleFor(x => x.ClassRoomId).NotEmpty();
    }
}

public class CreateTeacherRequestValidator : AbstractValidator<CreateTeacherRequest>
{
    public CreateTeacherRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Qualification).NotEmpty();
    }
}

public class CollectPaymentRequestValidator : AbstractValidator<CollectPaymentRequest>
{
    public CollectPaymentRequestValidator()
    {
        RuleFor(x => x.StudentFeeId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
    }
}

public class CreateExamRequestValidator : AbstractValidator<CreateExamRequest>
{
    public CreateExamRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ClassRoomId).NotEmpty();
        RuleFor(x => x.AcademicYearId).NotEmpty();
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
        RuleFor(x => x.Subjects).NotEmpty();
    }
}

public class CreateNoticeRequestValidator : AbstractValidator<CreateNoticeRequest>
{
    public CreateNoticeRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Content).NotEmpty();
    }
}

public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).WithMessage("New password must be at least 8 characters.");
    }
}

public class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).WithMessage("New password must be at least 8 characters.");
    }
}

public class RefreshTokenRequestValidator : AbstractValidator<RefreshTokenRequest>
{
    public RefreshTokenRequestValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty();
    }
}

public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Roles)
            .NotEmpty().WithMessage("At least one role must be specified.")
            .Must(roles => roles.All(r => r.Equals("HOD", StringComparison.OrdinalIgnoreCase) || r.Equals("Teacher", StringComparison.OrdinalIgnoreCase)))
            .WithMessage("Only HOD and Teacher roles can be assigned.");
    }
}

public class UpdateAdmissionStatusRequestValidator : AbstractValidator<UpdateAdmissionStatusRequest>
{
    public UpdateAdmissionStatusRequestValidator()
    {
        RuleFor(x => x.NewStatus).IsInEnum();
    }
}

public class UpdateStudentRequestValidator : AbstractValidator<UpdateStudentRequest>
{
    public UpdateStudentRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.RollNumber).NotEmpty();
        RuleFor(x => x.ClassRoomId).NotEmpty();
    }
}

public class CollectBulkPaymentRequestValidator : AbstractValidator<CollectBulkPaymentRequest>
{
    public CollectBulkPaymentRequestValidator()
    {
        RuleFor(x => x.StudentId).NotEmpty();
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one payment item must be provided.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Amount).GreaterThan(0).WithMessage("Payment amount must be greater than zero.");
        });
    }
}

public class SaveMarksRequestValidator : AbstractValidator<SaveMarksRequest>
{
    public SaveMarksRequestValidator()
    {
        RuleFor(x => x.ExamSubjectId).NotEmpty();
        RuleFor(x => x.Marks).NotNull();
        RuleForEach(x => x.Marks).ChildRules(mark =>
        {
            mark.RuleFor(m => m.StudentId).NotEmpty();
            mark.RuleFor(m => m.MarksObtained).GreaterThanOrEqualTo(0).WithMessage("Marks obtained cannot be negative.");
        });
    }
}

