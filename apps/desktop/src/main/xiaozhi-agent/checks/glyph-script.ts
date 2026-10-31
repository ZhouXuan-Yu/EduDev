/** Independent Windows text shaping, including OS fallback. Not OCR or Office pixel proof. */
export const GLYPH_CHECK_SCRIPT=String.raw`
$glyphReady=$false;$glyphRemaining=32000
try{Add-Type -AssemblyName PresentationCore,WindowsBase;$glyphReady=$true}catch{}
function Find-MissingGlyphs([string]$text,[string]$font){
 if(-not $glyphReady -or $text.Length -gt $script:glyphRemaining){return @{unchecked=$true;points=@()}}
 $script:glyphRemaining-=$text.Length
 $drawing=$null;$context=$null
 try{
  $drawing=New-Object Windows.Media.DrawingGroup;$context=$drawing.Open()
  $typeface=New-Object Windows.Media.Typeface($font)
  $formatted=New-Object Windows.Media.FormattedText($text,[Globalization.CultureInfo]::GetCultureInfo('zh-CN'),[Windows.FlowDirection]::LeftToRight,$typeface,24,[Windows.Media.Brushes]::Black,1.0)
  $context.DrawText($formatted,(New-Object Windows.Point(0,0)));$context.Close();$context=$null
  $points=New-Object 'Collections.Generic.HashSet[string]'
  $pending=New-Object 'Collections.Generic.Stack[object]';$pending.Push($drawing)
  while($pending.Count){
   $node=$pending.Pop()
   if($node -is [Windows.Media.DrawingGroup]){foreach($child in $node.Children){$pending.Push($child)}}
   elseif($node -is [Windows.Media.GlyphRunDrawing]){
    $run=$node.GlyphRun;$characters=-join $run.Characters
    for($i=0;$i -lt $characters.Length;$i++){
     if([char]::IsLowSurrogate($characters[$i])){continue}
     $category=[Globalization.CharUnicodeInfo]::GetUnicodeCategory($characters,$i)
     if($category -in @('Control','Format','SpaceSeparator','LineSeparator','ParagraphSeparator')){continue}
     $point=[char]::ConvertToUtf32($characters,$i)
     if(($point -ge 0xFE00 -and $point -le 0xFE0F) -or ($point -ge 0xE0100 -and $point -le 0xE01EF)){continue}
     $cluster=if($run.ClusterMap.Count){[int]$run.ClusterMap[$i]}else{$i}
     if($cluster -lt $run.GlyphIndices.Count -and $run.GlyphIndices[$cluster] -eq 0){[void]$points.Add(('U+{0:X4}' -f $point));if($points.Count -ge 16){break}}
    }
   }
  }
  return @{unchecked=$false;points=@($points | Sort-Object)}
 }catch{return @{unchecked=$true;points=@()}}
 finally{if($context){$context.Close()}}
}
`;
