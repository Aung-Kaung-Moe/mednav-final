import type {SavedCheckIn} from '../types/api';

export function baselineDifference(value:number|null,baseline:number):string {
  if(value===null)return 'Unknown';
  const difference=Number((value-baseline).toFixed(2));
  return `${difference>0?'+':''}${difference}`;
}
export function completeness(rows:SavedCheckIn[]) {
  return {recorded:rows.reduce((n,r)=>n+Number(r.hr!==null)+Number(r.sleep!==null)+Number(r.bp!==null),0),slots:rows.length*3};
}
