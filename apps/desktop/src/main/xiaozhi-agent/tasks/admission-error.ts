/** A denied task proposal/delivery is repairable model feedback. Storage failures
 * are deliberately NOT translated to this error and remain critical gates. */
export class TaskAdmissionError extends Error{
 readonly reason:string;
 constructor(reason:string){super(reason);this.name='TaskAdmissionError';this.reason=reason;}
}
export const taskAdmissionFailure=(e:unknown):e is TaskAdmissionError=>e instanceof TaskAdmissionError;
