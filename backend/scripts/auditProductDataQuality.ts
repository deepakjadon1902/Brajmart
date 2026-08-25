import dotenv from 'dotenv';
import path from 'path';
import { connectDb, dbQuery, describeDbTarget } from '../src/lib/db';
import { buildProductAuditReport } from '../src/lib/productDataQuality';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const main = async () => {
  await connectDb();
  const rows = await dbQuery<any>(
    `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN subcategories s ON p.subcategory_id = s.id
     ORDER BY p.created_at DESC`
  );
  const report = buildProductAuditReport(rows);

  console.log(`BrajMart product data audit`);
  console.log(`Database: ${describeDbTarget()}`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Products checked: ${report.totalProducts}`);
  console.log(`Products with issues: ${report.productsWithIssues}`);
  console.log(`Errors: ${report.errorCount}`);
  console.log(`Warnings: ${report.warningCount}`);

  if (Object.keys(report.issuesByCode).length) {
    console.log('\nIssues by code:');
    for (const [code, count] of Object.entries(report.issuesByCode).sort((a, b) => b[1] - a[1])) {
      console.log(`- ${code}: ${count}`);
    }
  }

  if (report.items.length) {
    console.log('\nProducts needing attention:');
    for (const item of report.items.slice(0, 50)) {
      console.log(`\n#${item.id || '<missing-id>'} ${item.name || '<missing-name>'}`);
      console.log(`  Category: ${item.category || '<missing>'}`);
      console.log(`  Price: ${item.price ?? '<invalid>'} | MRP: ${item.originalPrice ?? '<unset>'} | Rating: ${item.rating ?? '<invalid>'} (${item.reviewCount ?? '<invalid>'} reviews)`);
      for (const issue of item.issues) {
        console.log(`  - [${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`);
      }
    }
    if (report.items.length > 50) {
      console.log(`\nShowing first 50 of ${report.items.length} products with issues.`);
    }
  }
};

main()
  .catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 20);
  });
