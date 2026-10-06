import {render,screen,fireEvent} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import Fields from './AssetFormFields';
import type {Asset} from '@/types';
vi.mock('@/hooks/useFacilityDepartmentData',()=>({useFacilityDepartmentData:()=>({availableFacilities:[],departments:[]})}));
const asset:Asset={_id:'synthetic',ctrlNumber:'A',manufacturer:'Synthetic',model:'Pump',facilityId:'synthetic'};
test('confirmed date edits use explicit service field',()=>{const change=vi.fn();render(<Fields asset={asset} isReadOnly={false} handleChange={change} updateField={vi.fn()} />);fireEvent.change(screen.getByLabelText('Confirmed In-Service Date'),{target:{value:'2025-01-01'}});expect(change).toHaveBeenCalledWith('serviceStartDate','2025-01-01');});
test('clearing confirmed date uses null, not zero',()=>{const change=vi.fn();render(<Fields asset={{...asset,serviceStartDate:'2025-01-01'}} isReadOnly={false} handleChange={change} updateField={vi.fn()} />);fireEvent.change(screen.getByLabelText('Confirmed In-Service Date'),{target:{value:''}});expect(change).toHaveBeenCalledWith('serviceStartDate',null);});
test('read-only Asset cannot edit confirmed start',()=>{render(<Fields asset={asset} isReadOnly handleChange={vi.fn()} updateField={vi.fn()} />);expect(screen.getByLabelText('Confirmed In-Service Date')).toBeDisabled();});
