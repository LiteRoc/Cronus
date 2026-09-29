import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';
import Edit from './TemplateEditPage';
import Create from '../AddTemplate/TemplateCreatePage';
import List from '../ListTemplates/TemplateListPage';

const state = vi.hoisted(() => ({ role: 'admin' as string | undefined }));
const api = vi.hoisted(() => ({ getTemplateById: vi.fn(), getTemplateLifecycle: vi.fn(), archiveTemplate: vi.fn(), updateTemplate: vi.fn(), syncTemplate: vi.fn(), createTemplate: vi.fn(), createTempleteFromDI: vi.fn(), getTemplates: vi.fn(), getManufactures: vi.fn() }));
vi.mock('@/context/UserContext', () => ({ useUser: () => ({ user: { role: state.role } }) }));
vi.mock('@/services', () => api);
vi.mock('@/services/templateAPI', () => api);
vi.mock('./components/TemplateLifecycleSummaryCard', () => ({ default: () => <div>Lifecycle history</div> }));
const template = { _id: 'template', manufacturer: 'Synthetic', model: 'Device', description: 'Original', equipmentClass: 'Class II', status: 'Active', verified: false };
function page(Component = Edit) {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}><MemoryRouter initialEntries={['/templates/edit/template']}><Routes>
    <Route path="/templates/edit/:id" element={<Component />} />
    <Route path="/templates" element={<div>Template list destination</div>} />
  </Routes></MemoryRouter></SWRConfig>);
}
beforeEach(() => {
  vi.clearAllMocks(); state.role = 'admin';
  api.getTemplateById.mockResolvedValue({ ...template }); api.getTemplateLifecycle.mockResolvedValue({});
  api.archiveTemplate.mockResolvedValue({}); api.updateTemplate.mockResolvedValue({ template });
  api.createTemplate.mockResolvedValue({ template }); api.getTemplates.mockResolvedValue({ templates: [], totalCount: 0 }); api.getManufactures.mockResolvedValue([]);
  vi.spyOn(window, 'confirm').mockReturnValue(true); vi.spyOn(window, 'alert').mockImplementation(() => {});
});
test('admin archive action invokes supported helper and navigates after success', async () => {
  page(); fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
  await waitFor(() => expect(api.archiveTemplate).toHaveBeenCalledWith('template'));
  await screen.findByText('Template list destination'); expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
});
test('technician can edit active Template but has no archive control', async () => {
  state.role = 'technician'; page();
  expect(await screen.findByRole('button', { name: /Save/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Save/ }));
  await waitFor(() => expect(api.updateTemplate).toHaveBeenCalled());
});
for (const marker of [{ status: 'Archived' }, { deletedAt: 'old' }, { archivedAt: 'old' }]) test(`archived ${Object.keys(marker)[0]} is read-only while history remains`, async () => {
  api.getTemplateById.mockResolvedValue({ ...template, ...marker }); page();
  expect(await screen.findByRole('status')).toHaveTextContent('Archived template');
  expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Sync from FDA/ })).toBeNull();
  for (const input of screen.getAllByRole('textbox')) expect(input).toBeDisabled();
  expect(screen.getByText('Lifecycle history')).toBeVisible();
  expect(api.archiveTemplate).not.toHaveBeenCalled(); expect(api.updateTemplate).not.toHaveBeenCalled();
});
for (const role of ['customer', 'viewer', 'tech', undefined, 'unknown']) test(`${role}: unauthorized Template pages do not load data or expose controls`, async () => {
  state.role = role;
  for (const Component of [Edit, Create, List]) { const view = page(Component); expect(screen.getByRole('alert')).toHaveTextContent('do not have access'); view.unmount(); }
  expect(api.getTemplateById).not.toHaveBeenCalled(); expect(api.getTemplateLifecycle).not.toHaveBeenCalled(); expect(api.getTemplates).not.toHaveBeenCalled(); expect(api.getManufactures).not.toHaveBeenCalled();
});
test('technician creation page offers provider lookup but no manual create', () => {
  state.role = 'technician'; page(Create);
  expect(screen.getByRole('button', { name: /Sync from FDA/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /➕ Create/ })).toBeNull();
});
test('manual create sends no verification and uses canonical autoAddPmProcedure name', async () => {
  page(Create);
  fireEvent.change(screen.getByLabelText('Manufacturer *'), { target: { value: 'Synthetic' } });
  fireEvent.change(screen.getByLabelText('Model *'), { target: { value: 'Device' } });
  fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Description' } });
  fireEvent.change(screen.getByLabelText('Equipment Class *'), { target: { value: 'Class II' } });
  fireEvent.click(screen.getByRole('button', { name: /➕ Create/ }));
  await waitFor(() => expect(api.createTemplate).toHaveBeenCalled());
  const body = api.createTemplate.mock.calls[0][0]; expect(body).not.toHaveProperty('verified'); expect(body).toHaveProperty('autoAddPmProcedure', false); expect(body).not.toHaveProperty('autoAddPMProcedure');
});
test('provider sync unwraps the Template response and keeps the editor usable', async () => {
  api.syncTemplate.mockResolvedValue({ template: { ...template, verified: true, description: 'Provider data' } }); page();
  fireEvent.click(await screen.findByRole('button', { name: /Sync from FDA/ }));
  const inputs = screen.getAllByRole('textbox');
  fireEvent.change(inputs[inputs.length - 1], { target: { value: '00000000000001' } });
  fireEvent.click(screen.getByRole('button', { name: /🔄 Sync$/ }));
  await waitFor(() => expect(api.syncTemplate).toHaveBeenCalledWith('template', '00000000000001'));
  await waitFor(() => expect(screen.getByDisplayValue('Provider data')).toBeVisible());
});
