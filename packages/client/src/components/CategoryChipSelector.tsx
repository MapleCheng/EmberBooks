import { useState, useMemo } from "react";
import type { ICategory } from "@ember-books/shared";

const TYPE_LABELS: Record<string, string> = {
  expense: "支出",
  income: "收入",
  transfer: "轉帳",
};

interface CategoryChipSelectorProps {
  categories: ICategory[];
  selectedCategory: string;
  selectedSubcategory: string;
  onCategoryChange: (name: string) => void;
  onSubcategoryChange: (name: string) => void;
  type: string;
}

export function CategoryChipSelector({
  categories,
  selectedCategory,
  selectedSubcategory,
  onCategoryChange,
  onSubcategoryChange,
  type,
}: CategoryChipSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredCategories = useMemo(() => {
    let cats = categories.filter((c) => c.type === type);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      cats = cats.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.icon.toLowerCase().includes(q)
      );
    }
    return cats;
  }, [categories, type, search]);

  const groupedCategories = useMemo(() => {
    const groups: Record<string, ICategory[]> = {};
    for (const cat of filteredCategories) {
      const t = cat.type;
      if (!groups[t]) groups[t] = [];
      groups[t].push(cat);
    }
    return groups;
  }, [filteredCategories]);

  const selectedCat = categories.find((c) => c.name === selectedCategory);

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋分類..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />

      {/* Category chips grouped by type */}
      {Object.entries(groupedCategories).map(([groupType, cats]) => (
        <div key={groupType}>
          {Object.keys(groupedCategories).length > 1 && (
            <p className="text-xs text-gray-500 font-medium mb-1.5">
              {TYPE_LABELS[groupType] ?? groupType}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {cats.map((cat) => {
              const isSelected = cat.name === selectedCategory;
              return (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => onCategoryChange(cat.name)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors min-h-[36px] ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat.icon && <span className="mr-1">{cat.icon}</span>}
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {filteredCategories.length === 0 && (
        <p className="text-sm text-gray-400 py-2">找不到符合的分類</p>
      )}

      {/* Subcategory chips */}
      {selectedCat && selectedCat.subcategories.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1.5">
            子分類（{selectedCat.name}）
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSubcategoryChange("")}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors min-h-[36px] ${
                !selectedSubcategory
                  ? "bg-orange-400 text-white shadow-sm"
                  : "bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
            >
              不指定
            </button>
            {selectedCat.subcategories.map((sub) => {
              const isSelected = sub === selectedSubcategory;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onSubcategoryChange(sub)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors min-h-[36px] ${
                    isSelected
                      ? "bg-orange-400 text-white shadow-sm"
                      : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                  }`}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
