// src/scripts/backfillAssetTemplateIds.js
require("dotenv").config();
const mongoose = require("mongoose");
const Asset = require("../models/Asset");
const EquipmentTemplate = require("../models/EquipmentTemplate");

function norm(v = "") {
  return String(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const assets = await Asset.find({
    $or: [{ templateId: null }, { templateId: { $exists: false } }]
  });

  let matched = 0;
  const review = [];

  for (const asset of assets) {
    const aMan = norm(asset.manufacturer);
    const aModel = norm(asset.model);
    const aDesc = norm(asset.description);

    const templates = await EquipmentTemplate.find({
      manufacturer: new RegExp(asset.manufacturer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    });

    let candidates = templates
      .map(t => {
        const tModel = norm(t.model);
        const tVersion = norm(t.versionOrModel);
        const tBrand = norm(t.brandName);
        const tDesc = norm(t.description);

        let score = 0;

        if (norm(t.manufacturer) === aMan) score += 30;
        if (tModel === aModel) score += 50;
        if (tVersion === aModel) score += 45;
        if (tBrand && aModel.includes(tBrand)) score += 15;
        if (aDesc.includes(tModel) || aDesc.includes(tVersion)) score += 25;
        if (asset.regulationNumber && asset.regulationNumber === t.regulationNumber) score += 15;
        if (asset.classificationName && asset.classificationName === t.classificationName) score += 15;
        if (asset.submissionNumber && asset.submissionNumber === t.submissionNumber) score += 10;
        if (asset.manufacturerDUNS && asset.manufacturerDUNS === t.manufacturerDUNS) score += 20;

        return { template: t, score };
      })
      .filter(x => x.score >= 60)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 1 || candidates[0]?.score > candidates[1]?.score + 20) {
      const best = candidates[0].template;

      console.log(`MATCH: ${asset.ctrlNumber} ${asset.manufacturer} ${asset.model} -> ${best.manufacturer} ${best.model}`);

      asset.templateId = best._id;

      // Optional: copy FDA fields from template if missing
      asset.equipmentClass ||= best.equipmentClass;
      asset.classificationName ||= best.classificationName;
      asset.regulationNumber ||= best.regulationNumber;
      asset.panel ||= best.panel;
      asset.recordStatus ||= best.recordStatus;
      asset.submissionNumber ||= best.submissionNumber;
      asset.manufacturerDUNS ||= best.manufacturerDUNS;
      asset.gmdnDefinition ||= best.gmdnDefinition;
      asset.manufacturerRecommendedPMFrequency ||= best.manufacturerRecommendedPMFrequency;

      await asset.save();
      matched++;
    } else {
      review.push({
        ctrlNumber: asset.ctrlNumber,
        manufacturer: asset.manufacturer,
        model: asset.model,
        description: asset.description,
        candidates: candidates.slice(0, 3).map(c => ({
          score: c.score,
          templateId: c.template._id,
          manufacturer: c.template.manufacturer,
          model: c.template.model,
          di: c.template.di
        }))
      });
    }
  }

  console.log(`Matched: ${matched}`);
  console.log(`Needs review: ${review.length}`);
  console.dir(review, { depth: null });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});