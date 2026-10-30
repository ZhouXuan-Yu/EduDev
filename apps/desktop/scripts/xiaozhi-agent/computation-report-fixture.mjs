export const columns=[{key:'studentId',label:'学号',type:'text'},{key:'item',label:'项目',type:'text'},{key:'unitPrice',label:'单价',type:'number'},{key:'quantity',label:'数量',type:'number'},{key:'note',label:'备注',type:'text',nullable:true}];
export const csv='学号,项目,单价,数量,备注\r\n001,粉笔,10,3,"教具,备用"\r\n002,纸张,20,10,\r\n003,胶带,5,2,=1+1（文本）\r\n';
export const input={schemaVersion:'xiaozhi.table-input.v1',csv,delimiter:',',columns};
export const code='const rows=input.rows.map(row=>({...row,amount:row.unitPrice*row.quantity})); return {rows,summary:[{label:"合计",value:rows.reduce((sum,row)=>sum+row.amount,0)}]};';
export const reportColumns=[...columns,{key:'amount',label:'金额',type:'number'}];
export const outputs=[{format:'csv',path:'课堂费用.csv'},{format:'html',path:'课堂费用图表.html'},{format:'xlsx',path:'课堂费用.xlsx'}];
export const reportInput=resultId=>({resultId,title:'课堂费用统计',columns:reportColumns,chart:{category:'item',value:'amount'},outputs});
