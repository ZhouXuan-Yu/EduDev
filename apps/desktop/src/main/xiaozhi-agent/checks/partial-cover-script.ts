export const PARTIAL_COVER_LIMITS={page:512,total:8192,scan:4096} as const;
/** Native geometry only; no screenshot OCR, model judgment, or approximation from whole-box overlap. */
export const PARTIAL_COVER_SCRIPT=String.raw`
$script:coverCharsRemaining=${PARTIAL_COVER_LIMITS.total}
function Find-PartialTextCover($slide,$textRect,$covers){
 $possible=@($covers | Where-Object { $_.z -gt $textRect.z -and $_.x -lt $textRect.x+$textRect.w -and $_.x+$_.w -gt $textRect.x -and $_.y -lt $textRect.y+$textRect.h -and $_.y+$_.h -gt $textRect.y })
 if(-not $possible.Count){return @{unchecked=$false}}
 $shape=$null;$range=$null;$character=$null;$unchecked=$false
 try {
  $shape=$slide.Shapes.Item([int]$textRect.index)
  if([int]$shape.Id -ne [int]$textRect.id){return @{unchecked=$true}}
  $range=$shape.TextFrame.TextRange;$text=[string]$range.Text
  # Native code-unit indexing is independently checked below. Complex script/cluster layout stays unchecked.
  if($text -match '[^\x09-\x0d\x20-\x7e\u3000-\u303f\u3400-\u9fff\uff00-\uffef]'){return @{unchecked=$true}}
  $scan=[Math]::Min($text.Length,${PARTIAL_COVER_LIMITS.scan});if($scan -lt $text.Length){$unchecked=$true}
  for($i=0;$i -lt $scan;$i++){
   if([char]::IsWhiteSpace($text[$i]) -or [char]::IsControl($text[$i])){continue}
   if($script:coverCharsRemaining -le 0 -or $script:coverPageRemaining -le 0){return @{unchecked=$true}}
   $script:coverCharsRemaining--;$script:coverPageRemaining--
   try {
    $character=$range.Characters($i+1,1)
    if([string]$character.Text -cne $text.Substring($i,1)){return @{unchecked=$true}}
    $x=[double]$character.BoundLeft;$y=[double]$character.BoundTop;$w=[double]$character.BoundWidth;$h=[double]$character.BoundHeight
    if([double]::IsNaN($x+$y+$w+$h) -or [double]::IsInfinity($x+$y+$w+$h) -or $w -le 0 -or $h -le 0){$unchecked=$true;continue}
    foreach($cover in $possible){
     if($cover.x -le $x -and $cover.y -le $y -and $cover.x+$cover.w -ge $x+$w -and $cover.y+$cover.h -ge $y+$h){
      return @{unchecked=$true;finding=@{code='rendered_text_partly_covered';page=[int]$slide.SlideIndex;object=[int]$textRect.id;cover=[int]$cover.id;character=$i+1}}
     }
     if($cover.x -lt $x+$w -and $cover.x+$cover.w -gt $x -and $cover.y -lt $y+$h -and $cover.y+$cover.h -gt $y){$unchecked=$true}
    }
   }finally{if($character -and [Runtime.InteropServices.Marshal]::IsComObject($character)){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($character)};$character=$null}
  }
  return @{unchecked=$unchecked}
 }catch{return @{unchecked=$true}}
 finally{
  if($range -and [Runtime.InteropServices.Marshal]::IsComObject($range)){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range)}
  if($shape -and [Runtime.InteropServices.Marshal]::IsComObject($shape)){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shape)}
 }
}
`;
