type Task<T=unknown>={write:boolean;action:()=>Promise<T>;resolve:(value:T)=>void;reject:(error:unknown)=>void};

/** FIFO native read/write leases. Encoding never holds this gate. */
export class IndexAccess {
  private readers=0;
  private writing=false;
  private tasks:Task<any>[]=[];
  read<T>(action:()=>Promise<T>){return this.enqueue(false,action);}
  exclusive<T>(action:()=>Promise<T>){return this.enqueue(true,action);}
  private enqueue<T>(write:boolean,action:()=>Promise<T>):Promise<T>{
    return new Promise((resolve,reject)=>{this.tasks.push({write,action,resolve,reject});this.pump();});
  }
  private pump(){
    if(this.writing)return;
    while(this.tasks.length){
      if(this.tasks[0].write&&this.readers)return;
      const task=this.tasks.shift()!;
      if(task.write)this.writing=true;else this.readers++;
      void Promise.resolve().then(task.action).then(task.resolve,task.reject).finally(()=>{
        if(task.write)this.writing=false;else this.readers--;
        this.pump();
      });
      if(task.write)return;
    }
  }
}
