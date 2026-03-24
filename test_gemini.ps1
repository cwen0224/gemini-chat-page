param(
    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [string]$Prompt = "Say hello in one short sentence."
)

$models = @(
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-pro",
    "gemini-pro-latest"
)

$headers = @{
    "Content-Type" = "application/json"
    "x-goog-api-key" = $ApiKey
}

$body = @{
    contents = @(
        @{
            role  = "user"
            parts = @(
                @{
                    text = $Prompt
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

foreach ($model in $models) {
    $uri = "https://generativelanguage.googleapis.com/v1beta/models/{0}:generateContent" -f $model

    try {
        Write-Host "Trying $model..."
        $response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body -TimeoutSec 60

        $text = $response.candidates[0].content.parts[0].text
        if ($text) {
            Write-Host ""
            Write-Host "Model: $model"
            Write-Host "Response:"
            Write-Host $text
            exit 0
        }

        Write-Host "Model $model returned no text."
    }
    catch {
        $msg = $_.Exception.Message
        $details = $null
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $details = $reader.ReadToEnd()
            }
            catch {
                $details = $null
            }
        }

        if ($details) {
            Write-Host "Model $model failed: $msg"
            Write-Host "Response body:"
            Write-Host $details
        }
        else {
            Write-Host "Model $model failed: $msg"
        }
    }
}

Write-Error "All model attempts failed."
exit 1
