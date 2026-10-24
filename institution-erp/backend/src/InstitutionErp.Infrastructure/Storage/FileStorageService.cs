using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.Common.Interfaces;

namespace InstitutionErp.Infrastructure.Storage;

public class FileStorageService : IFileStorage
{
    private readonly SupabaseOptions _supabaseOptions;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<FileStorageService> _logger;
    private readonly string _baseStoragePath;
    private static readonly string[] AllowedExtensions = { ".pdf" };
    private const long MaxFileSize = 2 * 1024 * 1024; // 2 MB

    private bool IsSupabaseConfigured =>
        !string.IsNullOrWhiteSpace(_supabaseOptions.Url) &&
        !string.IsNullOrWhiteSpace(_supabaseOptions.ServiceRoleKey) &&
        _supabaseOptions.Url.StartsWith("http", StringComparison.OrdinalIgnoreCase);

    public FileStorageService(
        IOptions<SupabaseOptions> supabaseOptions,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<FileStorageService> logger)
    {
        _supabaseOptions = supabaseOptions.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;

        _baseStoragePath = configuration["Storage:BasePath"]
            ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "uploads");

        if (!Directory.Exists(_baseStoragePath))
        {
            Directory.CreateDirectory(_baseStoragePath);
        }
    }

    public async Task<string> SaveFileAsync(Stream stream, string fileName, string folder, CancellationToken cancellationToken = default)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
        {
            throw new InvalidOperationException($"File type '{ext}' is not allowed. Only PDF documents (.pdf) are accepted.");
        }

        if (stream.Length > MaxFileSize)
        {
            throw new InvalidOperationException("File size exceeds the 2 MB limit.");
        }

        var uniqueFileName = $"{Guid.NewGuid()}{ext}";
        var objectKey = $"{folder}/{uniqueFileName}".Replace("\\", "/");

        if (IsSupabaseConfigured)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var baseUrl = _supabaseOptions.Url.TrimEnd('/');
                var bucket = string.IsNullOrWhiteSpace(_supabaseOptions.StorageBucket) ? "campuscore-documents" : _supabaseOptions.StorageBucket;
                var requestUrl = $"{baseUrl}/storage/v1/object/{bucket}/{objectKey}";

                stream.Seek(0, SeekOrigin.Begin);
                using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
                request.Headers.Add("Authorization", $"Bearer {_supabaseOptions.ServiceRoleKey}");
                request.Headers.Add("apikey", _supabaseOptions.ServiceRoleKey);
                request.Headers.Add("x-upsert", "true");

                request.Content = new StreamContent(stream);
                request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");

                var response = await client.SendAsync(request, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("File {ObjectKey} uploaded successfully to Supabase bucket '{Bucket}'.", objectKey, bucket);
                    return objectKey;
                }

                var errBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Failed to upload file to Supabase Storage: {StatusCode} {Body}", response.StatusCode, errBody);
                throw new InvalidOperationException($"Failed to upload file to Supabase Storage: {response.StatusCode} {errBody}");
            }
            catch (Exception ex) when (ex is not InvalidOperationException)
            {
                _logger.LogError(ex, "Unexpected error uploading file to Supabase Storage.");
                throw new InvalidOperationException("Failed to upload file to Supabase Storage.", ex);
            }
        }

        // Local Disk Storage fallback (for development/offline)
        var folderPath = Path.Combine(_baseStoragePath, folder);
        if (!Directory.Exists(folderPath))
        {
            Directory.CreateDirectory(folderPath);
        }

        var fullPath = Path.Combine(folderPath, uniqueFileName);
        using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
        stream.Seek(0, SeekOrigin.Begin);
        await stream.CopyToAsync(fileStream, cancellationToken);

        return objectKey;
    }

    public async Task DeleteFileAsync(string filePath, CancellationToken cancellationToken = default)
    {
        var normalizedPath = filePath.Replace("\\", "/");

        if (IsSupabaseConfigured)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var baseUrl = _supabaseOptions.Url.TrimEnd('/');
                var bucket = string.IsNullOrWhiteSpace(_supabaseOptions.StorageBucket) ? "campuscore-documents" : _supabaseOptions.StorageBucket;
                var requestUrl = $"{baseUrl}/storage/v1/object/{bucket}/{normalizedPath}";

                using var request = new HttpRequestMessage(HttpMethod.Delete, requestUrl);
                request.Headers.Add("Authorization", $"Bearer {_supabaseOptions.ServiceRoleKey}");
                request.Headers.Add("apikey", _supabaseOptions.ServiceRoleKey);

                var response = await client.SendAsync(request, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Deleted file {ObjectKey} from Supabase bucket '{Bucket}'.", normalizedPath, bucket);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete file {FilePath} from Supabase Storage.", filePath);
            }
        }

        // Always ensure local file is cleaned up if present
        var fullPath = Path.Combine(_baseStoragePath, normalizedPath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }

    public async Task<Stream> GetFileStreamAsync(string filePath, CancellationToken cancellationToken = default)
    {
        var normalizedPath = filePath.Replace("\\", "/");

        if (IsSupabaseConfigured)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var baseUrl = _supabaseOptions.Url.TrimEnd('/');
                var bucket = string.IsNullOrWhiteSpace(_supabaseOptions.StorageBucket) ? "campuscore-documents" : _supabaseOptions.StorageBucket;
                var requestUrl = $"{baseUrl}/storage/v1/object/authenticated/{bucket}/{normalizedPath}";

                using var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
                request.Headers.Add("Authorization", $"Bearer {_supabaseOptions.ServiceRoleKey}");
                request.Headers.Add("apikey", _supabaseOptions.ServiceRoleKey);

                var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                if (response.StatusCode == HttpStatusCode.NotFound)
                {
                    // Check if file exists in local storage fallback
                    var localCheck = Path.Combine(_baseStoragePath, normalizedPath);
                    if (File.Exists(localCheck))
                    {
                        return new FileStream(localCheck, FileMode.Open, FileAccess.Read, FileShare.Read);
                    }
                    throw new FileNotFoundException("File not found in Supabase Storage.", filePath);
                }

                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStreamAsync(cancellationToken);
            }
            catch (FileNotFoundException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading file {FilePath} from Supabase Storage.", filePath);
                var localCheck = Path.Combine(_baseStoragePath, normalizedPath);
                if (File.Exists(localCheck))
                {
                    return new FileStream(localCheck, FileMode.Open, FileAccess.Read, FileShare.Read);
                }
                throw new FileNotFoundException("File not found on storage.", filePath, ex);
            }
        }

        // Local Disk Storage
        var fullPath = Path.Combine(_baseStoragePath, normalizedPath);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException("File not found on storage.", filePath);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return stream;
    }
}
