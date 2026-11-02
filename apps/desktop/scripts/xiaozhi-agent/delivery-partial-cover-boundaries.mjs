import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import '../office-agent/register-source.mjs';
const {PARTIAL_COVER_SCRIPT}=await import('../../src/main/xiaozhi-agent/checks/partial-cover-script.ts');
const output=await fs.mkdtemp(path.join(os.tmpdir(),'xiaozhi-partial-boundaries-'));
// Fault injection at the native TextRange boundary: prove unknowns never become false visual failures.
const script=PARTIAL_COVER_SCRIPT+String.raw`
$script:calls=0;$script:mockText='A B';$script:wrong=$false;$script:invalid=$false;$script:broken=$false
$range=[pscustomobject]@{Text=$script:mockText}
$range | Add-Member ScriptMethod Characters {param($start,$length)
 $script:calls++;if($script:broken){throw 'native failure'}
 $x=($start-1)*10;if($script:invalid){$x=[double]::NaN}
 $value=$script:mockText.Substring($start-1,1);if($script:wrong){$value='wrong'}
 return [pscustomobject]@{Text=$value;BoundLeft=$x;BoundTop=0;BoundWidth=5;BoundHeight=10}
}
$shape=[pscustomobject]@{Id=4;TextFrame=[pscustomobject]@{TextRange=$range}}
$shapes=[pscustomobject]@{};$shapes | Add-Member ScriptMethod Item {param($index) return $script:testShape}
$script:testShape=$shape;$slide=[pscustomobject]@{SlideIndex=6;Shapes=$shapes}
$text=@{id=4;index=1;z=1;x=0;y=0;w=30;h=10}
$results=@();function Test-Cover($name,$cover,$page=512,$total=8192){
 $script:calls=0;$script:coverPageRemaining=$page;$script:coverCharsRemaining=$total
 $actual=Find-PartialTextCover $slide $text @($cover)
 return @{name=$name;actual=$actual;calls=$script:calls;pageRemaining=$script:coverPageRemaining;totalRemaining=$script:coverCharsRemaining}
}
$cover=@{id=9;z=2;x=20;y=0;w=5;h=10}
$results+=Test-Cover 'covered-visible-character' $cover
$results+=Test-Cover 'whitespace-gap' @{id=9;z=2;x=10;y=0;w=5;h=10}
$results+=Test-Cover 'behind-text' @{id=9;z=0;x=20;y=0;w=5;h=10}
$results+=Test-Cover 'no-overlap' @{id=9;z=2;x=40;y=0;w=5;h=10}
$results+=Test-Cover 'stroke-only' @{id=9;z=2;x=2;y=0;w=1;h=10}
$results+=Test-Cover 'page-exhausted' $cover 0
$results+=Test-Cover 'deck-exhausted' $cover 512 0
$results+=Test-Cover 'page-hard-bound' $cover 1
$results+=Test-Cover 'deck-hard-bound' $cover 512 1
$script:wrong=$true;$results+=Test-Cover 'index-mismatch' $cover;$script:wrong=$false
$script:invalid=$true;$results+=Test-Cover 'nonfinite-bounds' $cover;$script:invalid=$false
$script:broken=$true;$results+=Test-Cover 'native-exception' $cover;$script:broken=$false
$range.Text=[char]0x0627;$results+=Test-Cover 'complex-script' $cover;$range.Text=$script:mockText
$shape.Id=7;$results+=Test-Cover 'object-mismatch' $cover
ConvertTo-Json -InputObject $results -Depth 6 -Compress
`;
await fs.writeFile(path.join(output,'probe.ps1'),'\uFEFF'+script);
const actual=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(output,'probe.ps1')],{windowsHide:true,encoding:'utf8',timeout:15000}));
for(const row of actual){
 if(row.name==='covered-visible-character'){
  assert.equal(row.actual.finding.character,3);assert.equal(row.actual.finding.page,6);assert.equal(row.actual.finding.object,4);assert.equal(row.actual.finding.cover,9);assert.equal(row.calls,2);
 }else{
  assert(!row.actual.finding,row.name);
  const clear=['whitespace-gap','behind-text','no-overlap'].includes(row.name);assert.equal(row.actual.unchecked,!clear,row.name);
 }
 if(['behind-text','no-overlap','page-exhausted','deck-exhausted','complex-script','object-mismatch'].includes(row.name))assert.equal(row.calls,0,row.name);
 if(['page-hard-bound','deck-hard-bound','index-mismatch','native-exception'].includes(row.name))assert.equal(row.calls,1,row.name);
 assert(row.pageRemaining>=0&&row.totalRemaining>=0,row.name);
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({ok:true,cases:actual,output},null,2));
console.log(JSON.stringify({ok:true,passed:actual.length,output}));
