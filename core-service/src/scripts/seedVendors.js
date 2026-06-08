// mongo shell script

const tenantId = ObjectId("69cfa11b41f774bb2a19f6b2")

db.vendors.insertMany([
  { name: "Block Imaging", tenantId, category: "ISO", notes: "Service has been poor since they were purchased by Siemens" },
  { name: "Probo Medical", tenantId, category: "ISO", notes: "Use for Ultrasounds" },
  { name: "Alpha Imaging", tenantId, category: "ISO", notes: "Do not use them" },
  { name: "Merit Medical", tenantId, category: "OEM", notes: "OEM - Mammography" },
  { name: "Mammotome", tenantId, category: "OEM", notes: "Mammography biopsy" },
  { name: "Equips", tenantId, category: "ISO", notes: "Do not use until further notice" }
])