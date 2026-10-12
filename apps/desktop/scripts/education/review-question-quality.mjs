/** A simulated teacher must use the actual card; never inject a confirmation hash through IPC. */
export async function reviewQuestionQuality(card){
 const panel=card.getByTestId('question-quality-review').last();
 await panel.getByTestId('question-quality-check').click();
 await panel.getByTestId('question-quality-status').getByText('格式与本组、实读原题的同题检查已完成，仍需人工复核。',{exact:true}).waitFor();
 await panel.getByTestId('question-quality-reviewed').locator('[data-slot=checkbox-content]').click();
 if(!await panel.getByTestId('question-quality-reviewed').getByRole('checkbox').isChecked())throw Error('Explicit quality acknowledgement missing');
}
