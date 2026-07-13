export const categories = [
  "Todos", "Good promoções", "Burger Gourmet", "Carne Industrial",
  "Carne Artesanal", "Frango", "Bebidas", "Porções", "Combos",
  "Exclusivos", "Hot dog",
] as const;

export type Category = Exclude<(typeof categories)[number], "Todos">;

export type Extra = { id: string; name: string; price: number };

export type Product = {
  id: string;
  name: string;
  subtitle: string;
  poem: string;
  description: string;
  ingredients: string[];
  price: number;
  originalPrice?: number;
  image: string;
  category: Category;
  popular?: boolean;
  custom?: boolean;
};

type CatalogRow = [
  id: string, name: string, description: string, price: number,
  image: string, category: Category, originalPrice?: number,
];

const catalog: CatalogRow[] = [
  ["bigg-chedar-good-combo", "Bigg Cheddar Good + fritas P + Coca lata", "Fritas 100g e Coca-Cola lata.", 44.9, "0a222d384d420ad0.webp", "Good promoções", 56.4],
  ["xtudo-combo", "X-Tudo + fritas + Coca lata", "X-Tudo, fritas 120g e Coca-Cola lata.", 44.9, "dfb2c1b4fbab39bc.webp", "Good promoções", 56.4],
  ["2-xtudo-coca", "2 X-Tudo + Coca 1,5L", "Dois X-Tudo e uma Coca-Cola 1,5L.", 59.9, "673e32d8cc0d2086.webp", "Good promoções", 74.8],
  ["2-x-bacon-coca", "2 X-Bacon + Coca lata", "Dois X-Bacon e uma Coca-Cola lata 350ml.", 46.8, "b55404149cf0b67f.webp", "Good promoções", 51.8],
  ["2-x-egg-bacon-coca", "2 X-Egg Bacon + Coca lata", "Dois X-Egg Bacon e uma Coca-Cola lata.", 52.8, "d1ff78cbca7060ad.webp", "Good promoções", 57.8],
  ["4-x-egg-bacon-coca", "4 X-Egg Bacon + Coca 1,5L", "Quatro X-Egg Bacon e uma Coca-Cola 1,5L.", 99.6, "c8653e72d4816844.webp", "Good promoções", 114.6],
  ["4-x-tudo-coca", "4 X-Tudo + Coca 1,5L", "Quatro X-Tudo, Coca-Cola 1,5L e a maionese da casa.", 119.6, "08e9d4b736afc758.webp", "Good promoções", 134.6],

  ["bigg-cheddar-good", "Bigg Cheddar Good", "Pão brioche, 2 blends de 140g, cheddar, cebola caramelizada e molho da casa.", 33.9, "f653fceae47fa34f.webp", "Burger Gourmet"],
  ["good-kids", "Good Kids", "Pão brioche, blend de 140g, cheddar e molho da casa. Acompanha batata 120g e suco de caixinha.", 34.9, "61a207022c00ff0c.webp", "Burger Gourmet"],
  ["good-burger-3", "Good Burger 3.0", "Pão brioche, 3 blends de 140g, onion rings, bacon, cheddar, cebola caramelizada, salada e molho da casa. Acompanha batata 120g.", 49.9, "8fda67b23ed7a314.webp", "Burger Gourmet"],
  ["good-especial", "Good Especial Burger", "Pão brioche, 2 blends de 140g, mussarela, bacon, cheddar, cebola caramelizada e molho da casa.", 39.9, "faaaad5cc638803e.webp", "Burger Gourmet"],
  ["good-onions", "Good Onions Burger", "Pão brioche, blend de 140g, cheddar, bacon, 2 onion rings e molho da casa.", 35.9, "59583eef9d9cfce9.webp", "Burger Gourmet"],
  ["good-ribs", "Good Ribs", "Pão brioche, carne 140g, costela ao barbecue, cream cheese, banana-da-terra, mussarela, bacon e molho da casa.", 49.9, "a936e05439882fcc.webp", "Burger Gourmet"],
  ["good-crisp", "Good Crisp", "Pão brioche, blend de 140g, bacon, cebola crisp, cheddar, salada e molho da casa.", 35.9, "fe566fac0a1b7ce2.png", "Burger Gourmet"],

  ["hamburguer", "Hambúrguer", "Pão, hambúrguer, alface, tomate, milho e batata palha.", 14.5, "108aa9d5ecbcc8ea.webp", "Carne Industrial"],
  ["x-burguer", "X-Burguer", "Pão, hambúrguer, queijo, alface, tomate, milho e batata palha.", 15.9, "b51cca2004860b3e.webp", "Carne Industrial"],
  ["egg-burguer", "Egg Burguer", "Pão, hambúrguer, ovo, alface, tomate, milho e batata palha.", 15.9, "904337ccc52f8a88.webp", "Carne Industrial"],
  ["big-burguer", "Big Burguer", "Pão, 2 hambúrgueres, alface, tomate, milho e batata palha.", 15.9, "e71159f97f27ab92.webp", "Carne Industrial"],
  ["x-salada", "X-Salada", "Pão, hambúrguer, queijo, apresuntado, alface, tomate, milho e batata palha.", 17.9, "fcdf048dc2fdfda4.webp", "Carne Industrial"],
  ["big-cheddar", "Big Cheddar", "Pão, 2 hambúrgueres, cheddar, alface, tomate, milho e batata palha.", 19.9, "4344641e6a98f1cb.webp", "Carne Industrial"],
  ["big-cheddar-bacon", "Big Cheddar Bacon", "Pão, 2 hambúrgueres, cheddar, bacon, alface, tomate, milho e batata palha.", 24.9, "e1af9f6c35939141.webp", "Carne Industrial"],
  ["x-egg", "X-Egg", "Pão, hambúrguer, ovo, queijo, apresuntado, alface, tomate, milho e batata palha.", 22, "1ab8fcd2f931585c.webp", "Carne Industrial"],
  ["x-bacon", "X-Bacon", "Pão, hambúrguer, bacon, queijo, apresuntado, alface, tomate, milho e batata palha.", 21.9, "2c1753c01e017ee5.webp", "Carne Industrial"],
  ["x-egg-bacon", "X-Egg Bacon", "Pão, hambúrguer, bacon, ovo, queijo, apresuntado, alface, tomate, milho e batata palha.", 24.9, "ef6227544465a880.webp", "Carne Industrial"],
  ["x-tudo", "X-Tudo", "Pão, 2 hambúrgueres, ovo, queijo, apresuntado, bacon, alface, tomate, milho e batata palha.", 29.9, "d4723361f830c5f4.webp", "Carne Industrial"],
  ["x-picanha", "X-Picanha", "Pão, hambúrguer de picanha, queijo, alface, tomate, milho e batata palha.", 19.9, "fe566fac0a1b7ce2.png", "Carne Industrial"],
  ["x-egg-picanha", "X-Egg Picanha", "Pão, hambúrguer de picanha, ovo, queijo, alface, tomate, milho e batata palha.", 27.9, "aa99e9f9beadd12b.webp", "Carne Industrial"],
  ["x-picanha-bacon", "X-Picanha Bacon", "Pão, hambúrguer de picanha, bacon, queijo, alface, tomate, milho e batata palha.", 27.9, "2ba8be4d724f6464.webp", "Carne Industrial"],
  ["x-egg-bacon-picanha", "X-Egg Bacon Picanha", "Pão, hambúrguer de picanha, bacon, ovo, queijo, apresuntado, alface, tomate, milho e batata palha.", 29.9, "e224a8b4ea6a1e96.webp", "Carne Industrial"],
  ["good-especial-1", "Good Burguer Especial I", "Pão, 2 hambúrgueres de picanha, 2 ovos, queijo, presunto, bacon, alface, tomate, milho e batata palha.", 37.9, "8f2b63e1ec530a55.webp", "Carne Industrial"],
  ["good-especial-2", "Good Burguer Especial II", "Pão, hambúrguer de picanha, frango, 2 ovos, bacon, queijo, presunto, alface, tomate, milho e batata palha.", 37.9, "420ceec1a57146d2.webp", "Carne Industrial"],
  ["misto", "Misto", "Pão, queijo e presunto.", 14.5, "fe566fac0a1b7ce2.png", "Carne Industrial"],
  ["misto-egg", "Misto Egg", "Pão, queijo, presunto e ovo.", 15.9, "fe566fac0a1b7ce2.png", "Carne Industrial"],

  ["hamburguer-artesanal", "Hambúrguer Artesanal", "Pão, carne caseira, alface, tomate, milho e batata palha.", 18.9, "11c5882c82c44088.webp", "Carne Artesanal"],
  ["x-burguer-artesanal", "X-Burguer Artesanal", "Pão, carne caseira, queijo, alface, tomate, milho e batata palha.", 19.9, "210113c84c1b4e67.webp", "Carne Artesanal"],
  ["x-salada-artesanal", "X-Salada Artesanal", "Pão, carne caseira, queijo, apresuntado, alface, tomate, milho e batata palha.", 22.9, "a82c08cca45acd67.webp", "Carne Artesanal"],
  ["x-egg-artesanal", "X-Egg Artesanal", "Pão, carne caseira, ovo, queijo, apresuntado, alface, tomate, milho e batata palha.", 28.9, "988dbdbe00ee415b.webp", "Carne Artesanal"],
  ["x-bacon-artesanal", "X-Bacon Artesanal", "Pão, carne caseira, bacon, queijo, presunto, alface, tomate, milho e batata palha.", 28.9, "18d54e8f31ffe991.webp", "Carne Artesanal"],
  ["x-egg-bacon-artesanal", "X-Egg Bacon Artesanal", "Pão, carne caseira, bacon, ovo, queijo, presunto, alface, tomate, milho e batata palha.", 31.9, "ec1d6762eadd4faa.webp", "Carne Artesanal"],
  ["x-tudo-artesanal", "X-Tudo Artesanal", "Pão, 2 carnes caseiras, ovo, bacon, queijo, apresuntado, alface, tomate, milho e batata palha.", 37.9, "a94189269f7a9b02.webp", "Carne Artesanal"],
  ["good-especial-artesanal", "Good Burger Especial Artesanal", "Pão, 2 blends de 100g, 2 ovos, bacon, queijo, presunto, alface, tomate, milho e batata palha.", 39.9, "fe566fac0a1b7ce2.png", "Carne Artesanal"],
  ["big-burger-caseiro", "Big Burger Caseiro", "Pão, 2 carnes caseiras, alface, tomate, milho e batata palha.", 30.9, "fe566fac0a1b7ce2.png", "Carne Artesanal"],

  ["hamburguer-frango", "Hambúrguer de Frango", "Pão, frango, alface, tomate, milho e batata palha.", 17.5, "b97ec31011f87980.webp", "Frango"],
  ["x-burguer-frango", "X-Burguer Frango", "Pão, frango, queijo, alface, tomate, milho e batata palha.", 20.9, "349d9300f59db3df.webp", "Frango"],
  ["x-frango-salada", "X-Frango Salada", "Pão, frango, queijo, apresuntado, alface, tomate, milho e batata palha.", 21.5, "78063e24043719cb.webp", "Frango"],
  ["x-egg-frango", "X-Egg Frango", "Pão, frango, ovo, queijo, apresuntado, alface, tomate, milho e batata palha.", 26.5, "511638f01a4f1255.webp", "Frango"],
  ["x-frango-bacon", "X-Frango Bacon", "Pão, frango, bacon, queijo, apresuntado, alface, tomate, milho e batata palha.", 26.5, "fe566fac0a1b7ce2.png", "Frango"],
  ["x-egg-bacon-frango", "X-Egg Bacon Frango", "Pão, frango, bacon, ovo, queijo, apresuntado, alface, tomate, milho e batata palha.", 29.9, "be8e55a7f3641825.webp", "Frango"],
  ["x-tudo-frango", "X-Tudo Frango", "Pão, 2 blends de frango, mussarela, apresuntado, ovo, bacon, alface, tomate, milho e batata palha.", 33.9, "fe566fac0a1b7ce2.png", "Frango"],

  ["coca-15", "Coca-Cola 1,5L", "Garrafa 1,5L.", 15, "f9685c23cdde089d.webp", "Bebidas"],
  ["agua", "Água", "Consulte a marca disponível.", 5, "540bf76ab1789126.webp", "Bebidas"],
  ["refrigerante-lata", "Refrigerante lata", "Consulte os sabores disponíveis.", 8, "9088fde537bf65fa.webp", "Bebidas"],
  ["sucos-500", "Sucos 500ml", "Consulte os sabores disponíveis.", 10.5, "4da04037685fd5f1.webp", "Bebidas"],
  ["agua-gas", "Água com gás", "Consulte a marca disponível.", 6.5, "ea95e4bd9c5878e6.webp", "Bebidas"],
  ["suco-maracuja", "Suco de maracujá", "Suco de polpa, 500ml.", 10.5, "657401b468413ef9.webp", "Bebidas"],
  ["suco-caixinha", "Suco de caixinha", "Suco Del Valle.", 5, "8385ff28883fe93a.webp", "Bebidas"],
  ["cerveja-latao", "Cerveja latão", "473ml. Antarctica ou Heineken.", 12, "fe566fac0a1b7ce2.png", "Bebidas"],

  ["batata-individual", "Batata frita individual", "Porção de 150g.", 14.5, "58c8f52e250b16fd.webp", "Porções"],
  ["batata-porcao", "Batata frita porção", "Porção de 400g.", 31.9, "ab2290dbe9ebaa43.webp", "Porções"],
  ["batata-cheddar-bacon", "Batata com cheddar e bacon", "Porção de 400g.", 38.5, "b7cc6d3e1cd97a51.webp", "Porções"],
  ["franguinho-1kg", "Franguinho 1kg", "1kg de frango frito e 400g de batata frita.", 76, "7a9e10848407cfba.webp", "Porções"],
  ["meio-franguinho", "1/2 Franguinho", "500g de frango frito e 150g de batata frita.", 55, "8ee2674e983832e9.webp", "Porções"],
  ["batata-p-cheddar-bacon", "Batata P com cheddar e bacon", "Porção de 150g.", 19.9, "b3bcf6516867f22b.webp", "Porções"],
  ["franguinho-individual", "Franguinho individual", "200g de frango a passarinho e 150g de batata.", 34.9, "f2218a54a3beb4ef.webp", "Porções"],
  ["onion-rings", "Porção de onion rings", "Porção de 200g.", 21.9, "7fcb12502631cc86.webp", "Porções"],
  ["batata-costela-p", "Batata P com costela e cream cheese", "Porção de 200g.", 29.9, "43fe1eb391c84145.webp", "Porções"],
  ["batata-costela-400", "Batata com costela e catupiry", "400g de batata frita recheada com cream cheese e costela bovina.", 48.9, "3960a0421cb14ef2.webp", "Porções"],

  ["combo-casal", "Combo casal: 2 X-Tudo + Coca 1,5L", "Dois X-Tudo e uma Coca-Cola 1,5L.", 71.06, "fe566fac0a1b7ce2.png", "Combos", 74.8],
  ["combo-familia-artesanal", "Combo família artesanal", "5 X-Tudo caseiros, batata G com cheddar e bacon e 2 Coca-Cola 1,5L.", 246.05, "fe566fac0a1b7ce2.png", "Combos", 259],
  ["combo-casal-gourmet", "Combo casal gourmet", "2 Good Especial Burger, batata P com cheddar e bacon e Coca-Cola 1,5L.", 108.97, "fe566fac0a1b7ce2.png", "Combos", 114.7],
  ["combo-egg-bacon", "Combo 4 X-Egg Bacon", "4 X-Egg Bacon, Coca-Cola 1,5L e batata P.", 122.64, "fe566fac0a1b7ce2.png", "Combos", 129.1],
  ["combo-egg-bacon-artesanal", "Combo 4 X-Egg Bacon artesanal", "4 X-Egg Bacon artesanais, Coca-Cola 1,5L e batata G.", 165.78, "fe566fac0a1b7ce2.png", "Combos", 174.5],
  ["combo-good-casal", "Combo Good Burger casal", "2 Good Burger Especial, batata P e Coca-Cola 1,5L.", 100.03, "fe566fac0a1b7ce2.png", "Combos", 105.3],
  ["combo-individual", "Combo individual X-Tudo", "X-Tudo, batata P e refrigerante lata ou suco 500ml.", 52.16, "fe566fac0a1b7ce2.png", "Combos", 54.9],
  ["combo-individual-artesanal", "Combo individual artesanal", "X-Tudo caseiro, batata P com cheddar e bacon e refrigerante lata ou suco 500ml.", 64.88, "fe566fac0a1b7ce2.png", "Combos", 68.3],

  ["pao-linguica", "Pão com linguiça", "Pão de sal, linguiça, mussarela, batata palha, salada, vinagrete, catupiry e molho da casa.", 20.9, "fe566fac0a1b7ce2.png", "Exclusivos"],
  ["pao-costela", "Pão de sal com costela", "Pão de sal, costela, mussarela, batata palha, salada, vinagrete, catupiry e molho da casa.", 25.9, "fe566fac0a1b7ce2.png", "Exclusivos"],
  ["hot-dog-simples", "Hot dog simples", "Pão, salsicha, molho, ovo de codorna, milho, batata palha e uvas-passas.", 12, "17055cecc90d3946.webp", "Hot dog"],
  ["hot-dog-duplo", "Hot dog duplo", "Pão, 2 salsichas, molho, ovo de codorna, milho, batata palha e uvas-passas.", 14, "4800cfc2602382b0.webp", "Hot dog"],
];

export const products: Product[] = catalog.map(
  ([id, name, description, price, image, category, originalPrice], index) => ({
    id, name, description, price, originalPrice, category,
    image: `/assets/goodburger/${image}`,
    subtitle: category,
    poem: description,
    ingredients: [],
    popular: category === "Good promoções" || index === 9,
  }),
);

export const extras: Extra[] = [
  { id: "bacon", name: "Bacon", price: 5 },
  { id: "ovo", name: "Ovo", price: 3 },
  { id: "queijo", name: "Queijo", price: 4 },
  { id: "cheddar", name: "Cheddar", price: 4 },
];

export const breads = ["Pão padrão do lanche"];
export const meats = [{ id: "padrao", name: "Carne padrão", price: 0 }];
export const cheeses = ["Queijo padrão"];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function findProduct(productId: string) {
  return products.find((product) => product.id === productId);
}
