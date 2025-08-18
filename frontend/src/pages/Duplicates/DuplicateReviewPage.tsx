import React, { useEffect, useState } from "react";
import { fetchAssets } from "../../services/assetAPI";
import { getTemplates } from "../../services/templateAPI";
import { Asset, EquipmentTemplate } from "../../types/types";
import { Link } from "react-router-dom";

const DuplicateReviewPage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);

  useEffect(() => {
    (async () => {
      const [a, t] = await Promise.all([fetchAssets(), getTemplates()]);
      setAssets(a.filter((x: any) => !!x.duplicateOf));
      setTemplates(t.templates.filter((x: any) => !!x.duplicateOf));
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-2 text-lg font-semibold">Asset Duplicates</h2>
        <div className="overflow-hidden rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Asset</th>
                <th className="px-3 py-2 text-left">Duplicate Of</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a: any) => (
                <tr key={a._id} className="border-t">
                  <td className="px-3 py-2">{a.ctrlNumber} — {a.manufacturer} {a.model}</td>
                  <td className="px-3 py-2">
                    <Link className="text-blue-600 underline" to={`/assets/edit/${a.duplicateOf}`}>{a.duplicateOf}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link className="rounded bg-blue-600 px-3 py-1 text-white" to={`/assets/edit/${a._id}`}>Review</Link>
                  </td>
                </tr>
              ))}
              {!assets.length && (
                <tr><td className="px-3 py-3 text-gray-500" colSpan={3}>No asset duplicates 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Template Duplicates</h2>
        <div className="overflow-hidden rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Template</th>
                <th className="px-3 py-2 text-left">Duplicate Of</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t: any) => (
                <tr key={t._id} className="border-t">
                  <td className="px-3 py-2">{t.manufacturer} {t.model} — {t.description}</td>
                  <td className="px-3 py-2">
                    <Link className="text-blue-600 underline" to={`/templates/edit/${t.duplicateOf}`}>{t.duplicateOf}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link className="rounded bg-blue-600 px-3 py-1 text-white" to={`/templates/edit/${t._id}`}>Review</Link>
                  </td>
                </tr>
              ))}
              {!templates.length && (
                <tr><td className="px-3 py-3 text-gray-500" colSpan={3}>No template duplicates 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DuplicateReviewPage;