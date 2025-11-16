
-- Test queries for static analyzer suggestions

-- 1. SELECT * warning
SELECT * FROM users WHERE email = 'user99999@demo.com';
SELECT * FROM orders;
SELECT * FROM products WHERE price > 100;

-- 2. JOIN without condition error
SELECT u.name, o.total 
FROM users u 
JOIN orders o;
SELECT * FROM customers c JOIN orders o;

-- 3. LIKE with leading % warning
SELECT * FROM users WHERE name LIKE '%john%';
SELECT email FROM users WHERE email LIKE '%@gmail.com';
SELECT * FROM products WHERE description LIKE '%discount%';

-- 4. ORDER BY without LIMIT warning
SELECT * FROM users ORDER BY created_at DESC;
SELECT name, email FROM customers ORDER BY name;
SELECT * FROM orders ORDER BY total_amount;

-- 5. DELETE without WHERE error
DELETE FROM users;
DELETE FROM orders WHERE status = 'completed';
DELETE FROM products;

-- 6. UPDATE without WHERE error
UPDATE users SET last_login = NOW();
UPDATE orders SET status = 'processed';
UPDATE products SET price = price * 1.1 WHERE category = 'electronics';

-- 7. INSERT without columns warning (pattern expects INSERT INTO table (columns) VALUES (...))
INSERT INTO users (id, name, email) VALUES (1, 'john', 'john@email.com');
INSERT INTO orders (id, user_id, status, total) VALUES (100, 1, 'pending', 99.99);
INSERT INTO products (id, name, price, category) VALUES (1, 'Laptop', 999.99, 'Electronics');

-- 8. SELECT without WHERE warning
SELECT * FROM users;
SELECT name, email FROM customers;
SELECT product_name, price FROM products;

-- Additional edge cases
SELECT * from

-- Mixed query with multiple issues
SELECT * FROM users u JOIN orders o ORDER BY o.total; 

SELECT * FROM users WHERE email LIKE '%example.com%' ORDER BY created_at;