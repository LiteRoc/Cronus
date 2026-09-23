import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import WorkOrderCostSummary from './WorkOrderCostSummary';
import type { WorkOrderCosts, CostScope } from '@/types/WorkOrderCosts';
const known: CostScope = {knownSubtotal:0,total:0,isComplete:true,missingComponents:[]};
test('zero is displayed while partial economics is explicitly incomplete', () => {
  const partial: CostScope = {...known,knownSubtotal:75,total:null,isComplete:false,missingComponents:[{component:'parts',reason:'unknown'}]};
  const costs: WorkOrderCosts = {calculationVersion:'wo-cost-v1',inputRevision:1,cacheState:'current',labor:75,parts:null,total:null,scopes:{internal:partial,vendorDirect:known,directMaintenance:partial}};
  render(<WorkOrderCostSummary costs={costs}/>);
  expect(screen.getAllByText(/Incomplete — known subtotal \$75.00/)).toHaveLength(2);
  expect(screen.getByText(/Vendor direct:/).parentElement).toHaveTextContent('$0.00');
});
test('legacy economics is not rendered as a zero total',()=>{render(<WorkOrderCostSummary/>);expect(screen.getByText('Historical economics are unverified.')).toBeInTheDocument();expect(screen.queryByText('$0.00')).not.toBeInTheDocument();});
