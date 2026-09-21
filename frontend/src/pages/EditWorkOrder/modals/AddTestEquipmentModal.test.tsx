import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import AddTestEquipmentModal from './AddTestEquipmentModal';

test('minimal picker fields display and submit only the Asset identity',async()=>{
  const attach=vi.fn().mockResolvedValue(undefined),close=vi.fn();
  render(<AddTestEquipmentModal equip={[{_id:'synthetic-A',ctrlNumber:'SYN-A',manufacturer:'Synthetic maker',model:'Meter'}]} onAttachEquip={attach} onClose={close}/>);
  expect(screen.getByRole('option',{name:'SYN-A - Synthetic maker - Meter'})).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'synthetic-A'}});
  fireEvent.click(screen.getByRole('button',{name:'Add'}));
  await waitFor(()=>expect(attach).toHaveBeenCalledWith('synthetic-A'));expect(close).toHaveBeenCalled();
});
