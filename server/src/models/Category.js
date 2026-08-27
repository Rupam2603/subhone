const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    parentId: { type: String, default: null, index: true },
    type: {
      type: String,
      enum: ["medicine", "supplement", "babyfood", "general"],
      default: "general",
    },
    description: { type: String },
    icon: { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.statics.getCategoryTree = async function (filter = { isActive: true }) {
  const categories = await this.find(filter).sort({ displayOrder: 1, name: 1 }).lean();
  const map = {};
  const roots = [];

  categories.forEach((cat) => {
    map[cat.id] = { ...cat, children: [] };
  });

  categories.forEach((cat) => {
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children.push(map[cat.id]);
    } else {
      roots.push(map[cat.id]);
    }
  });

  return roots;
};

categorySchema.statics.getDescendantCategoryIds = async function (categoryIds) {
  const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
  const allCategories = await this.find({ isActive: true }).lean();
  const result = new Set(ids);

  let added = true;
  while (added) {
    added = false;
    for (const cat of allCategories) {
      if (cat.parentId && result.has(cat.parentId) && !result.has(cat.id)) {
        result.add(cat.id);
        added = true;
      }
    }
  }

  return Array.from(result);
};

categorySchema.statics.getCategoryAndDescendantNames = async function (categoryNames) {
  const names = Array.isArray(categoryNames) ? categoryNames : [categoryNames];
  const allCategories = await this.find({ isActive: true }).lean();

  const matchingCats = allCategories.filter((c) => names.includes(c.name) || names.includes(c.id) || names.includes(c.slug));
  const matchedIds = new Set(matchingCats.map((c) => c.id));

  let added = true;
  while (added) {
    added = false;
    for (const cat of allCategories) {
      if (cat.parentId && matchedIds.has(cat.parentId) && !matchedIds.has(cat.id)) {
        matchedIds.add(cat.id);
        added = true;
      }
    }
  }

  const resultNames = allCategories
    .filter((c) => matchedIds.has(c.id))
    .map((c) => c.name);

  for (const n of names) {
    if (!resultNames.includes(n)) {
      resultNames.push(n);
    }
  }

  return resultNames;
};

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
