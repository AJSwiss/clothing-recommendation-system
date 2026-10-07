INSERT INTO clothing_items (name,category,subcategory,gender_tag,color,style,material,image_url,price) VALUES
('Midnight Essential Tee','tops','t-shirts','unisex','black','t-shirt','cotton','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700',28),
('Skyline Denim Jacket','tops','jackets','unisex','blue','jacket','denim','https://images.unsplash.com/photo-1551028719-00167b16eac5?w=700',89),
('Everyday Straight Jeans','bottoms','jeans','unisex','blue','straight-leg','denim','https://images.unsplash.com/photo-1542272604-787c3835535d?w=700',74),
('Cloud Knit Sweater','tops','sweaters','women','white','sweater','cotton','https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=700',62),
('Relaxed Utility Pants','bottoms','pants','men','green','baggy','cotton','https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700',68),
('Canvas Low Tops','shoes','sneakers','unisex','white','casual','cotton','https://images.unsplash.com/photo-1549298916-b41d501d3772?w=700',55),
('Ribbed Tank','tops','tanks','women','blue','tank top','spandex','https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700',32),
('Leather Crossbody','accessories','bags','unisex','black','minimal','leather','https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=700',48)
ON CONFLICT DO NOTHING;
