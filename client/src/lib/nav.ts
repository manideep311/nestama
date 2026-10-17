export interface NavItem {
  label: string;
  href: string;
  /** Highlight treatment (Offers). */
  accent?: boolean;
}

export const categoryNav: NavItem[] = [
  { label: "Dogs", href: "/shop?pet=dog" },
  { label: "Cats", href: "/shop?pet=cat" },
  { label: "Food", href: "/c/food-treats" },
  { label: "Accessories", href: "/c/accessories" },
  { label: "Toys", href: "/c/toys" },
  { label: "Grooming", href: "/c/grooming" },
  { label: "Beds & Furniture", href: "/c/beds-furniture" },
  { label: "Health & Wellness", href: "/c/health-wellness" },
  { label: "Travel", href: "/c/travel" },
  { label: "Offers", href: "/offers", accent: true },
];

export const footerNav = {
  shop: [
    { label: "Dog essentials", href: "/shop?pet=dog" },
    { label: "Cat essentials", href: "/shop?pet=cat" },
    { label: "Food & treats", href: "/c/food-treats" },
    { label: "Beds & furniture", href: "/c/beds-furniture" },
    { label: "Offers", href: "/offers" },
  ],
  help: [
    { label: "Track your order", href: "/account/orders" },
    { label: "Shipping & returns", href: "/shipping-returns" },
    { label: "FAQs", href: "/faq" },
    { label: "Contact us", href: "/contact" },
  ],
  company: [
    { label: "About NESTAMA", href: "/about" },
    { label: "Your account", href: "/account" },
    { label: "Wishlist", href: "/account/wishlist" },
  ],
};
