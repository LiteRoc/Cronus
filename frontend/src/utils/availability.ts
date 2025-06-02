export function getAvailability(quantity: number): string {
    return quantity > 0 ? "In Stock" : "Out of Stock";
  }
  