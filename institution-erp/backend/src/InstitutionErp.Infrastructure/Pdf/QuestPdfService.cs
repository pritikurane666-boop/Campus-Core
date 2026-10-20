using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Domain.Entities;

namespace InstitutionErp.Infrastructure.Pdf;

public class QuestPdfService : IPdfService
{
    public QuestPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public Task<byte[]> GenerateFeeReceiptPdfAsync(
        FeePayment payment,
        FeeReceipt receipt,
        Student student,
        ClassRoom classRoom,
        FeeStructureItem item)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A5.Landscape());
                page.Margin(20);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Arial"));

                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("CAMPUS CORE INSTITUTION").Bold().FontSize(16).FontColor(Colors.Blue.Darken2);
                            c.Item().Text("Higher Education & Academic Excellence ERP").FontSize(9).FontColor(Colors.Grey.Medium);
                            c.Item().Text("Official Fee Payment Receipt").SemiBold().FontSize(11).FontColor(Colors.Grey.Darken3);
                        });

                        row.ConstantItem(150).AlignRight().Column(c =>
                        {
                            c.Item().Text($"Receipt No: {receipt.ReceiptNumber}").Bold().FontSize(10);
                            c.Item().Text($"Date: {receipt.IssueDate:dd MMM yyyy}").FontSize(9);
                            c.Item().Text($"Mode: {payment.Mode}").FontSize(9).FontColor(Colors.Green.Darken2);
                        });
                    });

                    col.Item().PaddingVertical(5).LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
                });

                page.Content().PaddingVertical(10).Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Student Name: {student.User?.FullName ?? "Student"}").Bold();
                            c.Item().Text($"Reg No: {student.StudentRegistrationNumber} | Roll No: {student.RollNumber}");
                            c.Item().Text($"Class: {classRoom.FullName}");
                        });

                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Fee Head: {item.FeeHead?.Name ?? "Academic Fee"}");
                            c.Item().Text($"Txn Ref: {payment.TransactionReference ?? "N/A"}");
                            c.Item().Text($"Received By: {payment.ReceivedBy}");
                        });
                    });

                    col.Item().PaddingVertical(10).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(40);
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(5).Text("#").Bold();
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(5).Text("Fee Particulars").Bold();
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(5).AlignRight().Text("Due Date").Bold();
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(5).AlignRight().Text("Amount Paid (₹)").Bold();
                        });

                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text("1");
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(item.FeeHead?.Name ?? "Tuition Fee");
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).AlignRight().Text($"{item.DueDate:dd/MM/yyyy}");
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).AlignRight().Text($"{payment.Amount:N2}").Bold();
                    });

                    col.Item().PaddingTop(15).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Thank you for your payment.").Italic().FontSize(9);
                            c.Item().Text("This is a computer generated document, signature not mandatory.").FontSize(8).FontColor(Colors.Grey.Medium);
                        });

                        row.ConstantItem(120).AlignRight().Column(c =>
                        {
                            c.Item().PaddingTop(20).LineHorizontal(0.5f).LineColor(Colors.Grey.Darken1);
                            c.Item().AlignCenter().Text("Accounts Officer").FontSize(8);
                        });
                    });
                });
            });
        });

        var bytes = document.GeneratePdf();
        return Task.FromResult(bytes);
    }

    public Task<byte[]> GenerateReportCardPdfAsync(
        Student student,
        Exam exam,
        IReadOnlyList<(ExamSubject subject, ExamMark mark)> results,
        decimal attendancePercentage,
        string grade,
        decimal totalMarks,
        decimal maxMarks,
        decimal percentage,
        int rank)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Arial"));

                page.Header().Column(col =>
                {
                    col.Item().AlignCenter().Text("CAMPUS CORE ACADEMIC INSTITUTION").Bold().FontSize(18).FontColor(Colors.Blue.Darken3);
                    col.Item().AlignCenter().Text("Affiliated to National Education Board | Excellence in Education").FontSize(10).FontColor(Colors.Grey.Darken1);
                    col.Item().AlignCenter().PaddingVertical(5).Text($"STUDENT PERFORMANCE REPORT - {exam.Name.ToUpper()}").Bold().FontSize(13).FontColor(Colors.Indigo.Darken2);
                    col.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
                });

                page.Content().PaddingVertical(15).Column(col =>
                {
                    // Student details card
                    col.Item().Background(Colors.Grey.Lighten4).Padding(10).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Student Name: {student.User?.FullName ?? "N/A"}").Bold();
                            c.Item().Text($"Registration No: {student.StudentRegistrationNumber}");
                            c.Item().Text($"Roll Number: {student.RollNumber}");
                        });

                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Class & Section: {exam.ClassRoom?.FullName ?? "N/A"}").Bold();
                            c.Item().Text($"Attendance: {attendancePercentage:F1}%").FontColor(attendancePercentage >= 75 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                            c.Item().Text($"Class Rank: #{rank}").Bold().FontColor(Colors.Blue.Darken2);
                        });
                    });

                    col.Item().PaddingVertical(15).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(30);
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Blue.Darken2).Padding(6).Text("#").FontColor(Colors.White).Bold();
                            header.Cell().Background(Colors.Blue.Darken2).Padding(6).Text("Subject").FontColor(Colors.White).Bold();
                            header.Cell().Background(Colors.Blue.Darken2).Padding(6).AlignRight().Text("Max Marks").FontColor(Colors.White).Bold();
                            header.Cell().Background(Colors.Blue.Darken2).Padding(6).AlignRight().Text("Pass Marks").FontColor(Colors.White).Bold();
                            header.Cell().Background(Colors.Blue.Darken2).Padding(6).AlignRight().Text("Marks Obtained").FontColor(Colors.White).Bold();
                            header.Cell().Background(Colors.Blue.Darken2).Padding(6).AlignCenter().Text("Result").FontColor(Colors.White).Bold();
                        });

                        int idx = 1;
                        foreach (var (sub, mk) in results)
                        {
                            var passed = !mk.IsAbsent && mk.MarksObtained >= sub.PassMarks;
                            var bg = idx % 2 == 0 ? Colors.Grey.Lighten5 : Colors.White;

                            table.Cell().Background(bg).Padding(5).Text(idx.ToString());
                            table.Cell().Background(bg).Padding(5).Text(sub.Subject?.Name ?? "Subject");
                            table.Cell().Background(bg).Padding(5).AlignRight().Text($"{sub.MaxMarks:F0}");
                            table.Cell().Background(bg).Padding(5).AlignRight().Text($"{sub.PassMarks:F0}");
                            table.Cell().Background(bg).Padding(5).AlignRight().Text(mk.IsAbsent ? "ABSENT" : $"{mk.MarksObtained:F1}").Bold();
                            table.Cell().Background(bg).Padding(5).AlignCenter().Text(passed ? "PASS" : "FAIL").FontColor(passed ? Colors.Green.Darken2 : Colors.Red.Darken2).Bold();
                            idx++;
                        }
                    });

                    // Summary statistics
                    col.Item().PaddingVertical(10).Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Total Marks: {totalMarks:F1} / {maxMarks:F0}").Bold();
                            c.Item().Text($"Aggregate Percentage: {percentage:F2}%").Bold();
                        });

                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Overall Grade: {grade}").Bold().FontSize(12).FontColor(Colors.Indigo.Darken2);
                            c.Item().Text($"Result Status: {(percentage >= 35 ? "PASSED" : "FAILED")}").Bold().FontColor(percentage >= 35 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                        });
                    });

                    // Grading scale reference
                    col.Item().PaddingTop(10).Column(c =>
                    {
                        c.Item().Text("Grading Scale: A+ (90-100%), A (80-89%), B (70-79%), C (50-69%), D (35-49%), F (<35%)").FontSize(8).FontColor(Colors.Grey.Darken1);
                    });

                    // Signatures
                    col.Item().PaddingTop(40).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Darken2);
                            c.Item().AlignCenter().Text("Class Teacher").FontSize(9);
                        });

                        row.ConstantItem(60);

                        row.RelativeItem().Column(c =>
                        {
                            c.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Darken2);
                            c.Item().AlignCenter().Text("Examination Head").FontSize(9);
                        });

                        row.ConstantItem(60);

                        row.RelativeItem().Column(c =>
                        {
                            c.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Darken2);
                            c.Item().AlignCenter().Text("Principal / Dean").FontSize(9).Bold();
                        });
                    });
                });
            });
        });

        var bytes = document.GeneratePdf();
        return Task.FromResult(bytes);
    }
}
