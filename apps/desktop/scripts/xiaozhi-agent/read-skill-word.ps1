param([Parameter(Mandatory=$true)][string]$CaseDirectory)
$ErrorActionPreference='Stop'
$testRoot=(Resolve-Path -LiteralPath 'test-results/xiaozhi-agent').Path
$caseRoot=(Resolve-Path -LiteralPath $CaseDirectory).Path
if((Split-Path -Parent $caseRoot) -ne $testRoot -or (Split-Path -Leaf $caseRoot) -notlike 'pi-skill-capability-*'){throw 'Owned skill case required'}
$report=Get-Content -LiteralPath (Join-Path $caseRoot 'after-report.json') -Raw | ConvertFrom-Json
if(-not $report.success){throw 'Failed cases remain failed; this reader requires a successful after report'}
$workspace=(Resolve-Path -LiteralPath (Join-Path $caseRoot 'workspace')).Path
$target=(Resolve-Path -LiteralPath (Join-Path $workspace $report.office.path)).Path
if(-not $target.StartsWith($workspace+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Document outside owned workspace'}
$digest=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
if($digest -ne $report.office.sha256){throw 'Saved file changed'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[IO.Compression.ZipFile]::OpenRead($target)
try{
 $entry=$archive.GetEntry('word/document.xml');if(-not $entry){throw 'Missing actual DOCX document XML'}
 $reader=[IO.StreamReader]::new($entry.Open())
 try{[xml]$xml=$reader.ReadToEnd()}finally{$reader.Dispose()}
 $ns=[Xml.XmlNamespaceManager]::new($xml.NameTable);$ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
 $paragraphs=@($xml.SelectNodes('//w:p',$ns) | ForEach-Object { (@($_.SelectNodes('.//w:t',$ns) | ForEach-Object {$_.InnerText})) -join '' })
 $body=$paragraphs -join "`n"
 $expected=@($report.office.draft.title)
 foreach($section in $report.office.draft.sections){$expected+=@($section.heading)+@($section.paragraphs);if($section.table){$expected+=@($section.table.columns);foreach($row in $section.table.rows){$expected+=@($row)}}}
 foreach($text in $expected){if($null -ne $text -and "$text".Trim() -and -not $body.Contains("$text")){throw ('Missing reviewed content: '+"$text".Substring(0,[Math]::Min(40,"$text".Length)))}}
 foreach($week in 1..4){if($body -notmatch ('第\s*'+$week+'\s*周')){throw "Missing actual week $week"}}
 $weeklyBlank=0
 foreach($table in $xml.SelectNodes('//w:tbl',$ns)){
  $rows=@($table.SelectNodes('./w:tr',$ns));$heads=@($rows[0].SelectNodes('./w:tc',$ns) | ForEach-Object {($_.SelectNodes('.//w:t',$ns) | ForEach-Object {$_.InnerText}) -join ''})
  $owner=-1;for($index=0;$index -lt $heads.Count;$index++){if($heads[$index] -like '*负责人*'){$owner=$index;break}}
  if($owner -lt 0){continue}
  foreach($row in $rows | Select-Object -Skip 1){$cells=@($row.SelectNodes('./w:tc',$ns));$first=($cells[0].SelectNodes('.//w:t',$ns) | ForEach-Object {$_.InnerText}) -join '';if($first -notmatch '^第\s*[1-4]\s*周'){continue};if($cells.Count -ne $heads.Count){throw 'Actual DOCX table row width mismatch'};$value=($cells[$owner].SelectNodes('.//w:t',$ns) | ForEach-Object {$_.InnerText}) -join '';if($value.Trim()){throw 'Weekly owner was not blank'};$weeklyBlank++}
 }
 if($weeklyBlank -eq 0){foreach($week in 1..4){if($body -notmatch ('第\s*'+$week+'\s*周[\s\S]*?负责人[：:]\s*[_＿]{2,}')){throw "Missing weekly blank owner $week"}}}
 $result=[ordered]@{success=$true;boundary='Independent read-only DOCX OOXML, not WPS/visual pagination acceptance';sha256=$digest;paragraphs=$paragraphs.Count;tables=$xml.SelectNodes('//w:tbl',$ns).Count;weeklyBlankOwnerCells=$weeklyBlank;reviewedTextsChecked=$expected.Count}
 $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $caseRoot 'word-readback.json') -Encoding utf8
 $result | ConvertTo-Json -Compress
}finally{$archive.Dispose()}
