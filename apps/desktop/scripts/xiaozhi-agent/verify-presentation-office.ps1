param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference='Stop'
$fixtureRoot=[IO.Path]::GetFullPath($Directory)
if(-not (Split-Path $fixtureRoot -Leaf).StartsWith('xiaozhi-presentation-')) { throw 'Only the isolated presentation fixture directory is allowed' }
$source=Join-Path $fixtureRoot 'floating.pptx'
$copy=Join-Path $fixtureRoot 'office-edited.pptx'
if(Test-Path -LiteralPath $copy) { throw 'Fixture copy already exists' }
$before=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$existing=@(Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$powerPoint=$null;$deck=$null;$reopened=$null
try {
  $powerPoint=New-Object -ComObject PowerPoint.Application
  $deck=$powerPoint.Presentations.Open($source,-1,0,0)
  if($deck.Slides.Count -ne 8) { throw 'Native PowerPoint page count is not eight' }
  $rows=@()
  for($i=1;$i -le $deck.Slides.Count;$i++) {
    $slide=$deck.Slides.Item($i)
    $notes=$slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text
    if([string]::IsNullOrWhiteSpace($notes)) { throw "Missing native notes on page $i" }
    $slide.Export((Join-Path $fixtureRoot ('slide-{0:D2}.png' -f $i)),'PNG',1600,900)
    $rows+=@{page=$i;notes=$notes;shapes=$slide.Shapes.Count}
  }
  $four=$deck.Slides.Item(4)
  $four.Shapes.Item('xiaozhi-page:variables').TextFrame.TextRange.Text='排液体积'
  $table=@($four.Shapes | Where-Object { $_.HasTable -eq -1 })[0]
  $table.Table.Cell(2,2).Shape.TextFrame.TextRange.Text='250–900kg/m³'
  $four.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text='PowerPoint编辑并读回的教师备注'
  $deck.SaveCopyAs($copy,24,0)
  $deck.Close();$deck=$null
  $reopened=$powerPoint.Presentations.Open($copy,-1,0,0)
  if($reopened.Slides.Count -ne 8) { throw 'Reopened edited copy lost pages' }
  $four=$reopened.Slides.Item(4)
  if($four.Shapes.Item('xiaozhi-page:variables').TextFrame.TextRange.Text -ne '排液体积') { throw 'Native title edit did not survive save/reopen' }
  if($four.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text -ne 'PowerPoint编辑并读回的教师备注') { throw 'Native notes edit did not survive save/reopen' }
  $table=@($four.Shapes | Where-Object { $_.HasTable -eq -1 })[0]
  if($table.Table.Cell(2,2).Shape.TextFrame.TextRange.Text -ne '250–900kg/m³') { throw 'Native table edit did not survive save/reopen' }
  $four.Export((Join-Path $fixtureRoot 'office-edited-page4.png'),'PNG',1600,900)
  if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $before) { throw 'Original fixture changed' }
  @{ok=$true;pages=8;readWriteReopen=$true;originalHash=$before;notes=$rows;copy=$copy;boundary='Actual installed PowerPoint rendering and text/table/notes editing of synthetic files only; no WPS or real teacher acceptance'} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $fixtureRoot 'office-report.json') -Encoding UTF8
} finally {
  if($reopened) { $reopened.Close() }
  if($deck) { $deck.Close() }
  if($powerPoint) { if($existing.Count -eq 0) { $powerPoint.Quit() }; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerPoint) }
}
