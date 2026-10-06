import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import Picker, { contractResponsibilityOptions } from './VendorResponsibilityPicker';
const assets = [{
  _id: 'A',
  ctrlNumber: 'Contract A'
}, {
  _id: 'B',
  ctrlNumber: 'Facility B'
}];
test('picker offers only Contract membership', () => {
  render(<Picker assets={assets} coverage={['A']} selected={[]} onChange={vi.fn()} />);
  expect(screen.getByLabelText('Contract A')).toBeInTheDocument();
  expect(screen.queryByLabelText('Facility B')).not.toBeInTheDocument();
});
test('duplicate options normalize', () => expect(contractResponsibilityOptions([...assets, assets[0]], ['A'])).toEqual([assets[0]]));
test('valid selection does not erase anomalous responsibility', () => {
  const change = vi.fn();
  render(<Picker assets={assets} coverage={['A']} selected={['B']} onChange={change} />);
  fireEvent.click(screen.getByLabelText('Contract A'));
  expect(change).toHaveBeenCalledWith(['B', 'A']);
});
test('out-of-coverage assignment is visible and not silently removed', () => {
  const change = vi.fn();
  render(<Picker assets={assets} coverage={['A']} selected={['B']} onChange={change} />);
  expect(screen.getByRole('alert')).toHaveTextContent('outside current Contract coverage');
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Remove assignment'));
  expect(change).toHaveBeenCalledWith([]);
});
test('missing hydration warning distinguishes Contract member', () => {
  render(<Picker assets={[]} coverage={['A']} selected={['A']} onChange={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('unavailable for selection');
  expect(screen.getByText('No current Contract Assets available.')).toBeInTheDocument();
});
test('deselect is explicit and retains other responsibility', () => {
  const change = vi.fn();
  render(<Picker assets={assets} coverage={['A']} selected={['A', 'B']} onChange={change} />);
  fireEvent.click(screen.getByLabelText('Contract A'));
  expect(change).toHaveBeenCalledWith(['B']);
});
