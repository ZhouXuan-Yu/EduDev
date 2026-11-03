/** Operate the installed HeroUI select through its visible teacher controls. */
export async function chooseTrainingOption(page,testId,value){
 await page.getByTestId(testId).click();
 await page.locator('[role="option"][data-option-id="'+value+'"]').click();
}
