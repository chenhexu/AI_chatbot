#!/usr/bin/env tsx
/**
 * Analyze test results and provide insights
 * 
 * Usage: tsx scripts/analyze-test-results.ts <report-file>
 */

import * as fs from 'fs';
import * as path from 'path';

interface Analysis {
  totalQuestions: number;
  totalSuccess: number;
  totalFailed: number;
  successRate: number;
  frenchSuccess: number;
  frenchTotal: number;
  frenchRate: number;
  englishSuccess: number;
  englishTotal: number;
  englishRate: number;
  categoryBreakdown: Map<string, { success: number; total: number; rate: number }>;
  issues: string[];
  recommendations: string[];
}

function analyzeReport(reportPath: string): Analysis {
  const content = fs.readFileSync(reportPath, 'utf-8');
  const lines = content.split('\n');
  
  const analysis: Analysis = {
    totalQuestions: 0,
    totalSuccess: 0,
    totalFailed: 0,
    successRate: 0,
    frenchSuccess: 0,
    frenchTotal: 0,
    frenchRate: 0,
    englishSuccess: 0,
    englishTotal: 0,
    englishRate: 0,
    categoryBreakdown: new Map(),
    issues: [],
    recommendations: []
  };
  
  // Parse overall stats
  const totalMatch = content.match(/Total Questions: (\d+)/);
  const successMatch = content.match(/Total Success: (\d+)/);
  const failedMatch = content.match(/Total Failed: (\d+)/);
  
  if (totalMatch) analysis.totalQuestions = parseInt(totalMatch[1]);
  if (successMatch) analysis.totalSuccess = parseInt(successMatch[1]);
  if (failedMatch) analysis.totalFailed = parseInt(failedMatch[1]);
  analysis.successRate = analysis.totalQuestions > 0 
    ? (analysis.totalSuccess / analysis.totalQuestions) * 100 
    : 0;
  
  // Parse French stats
  const frenchMatch = content.match(/FRENCH QUESTIONS[\s\S]*?Total: (\d+)[\s\S]*?Success: (\d+)/);
  if (frenchMatch) {
    analysis.frenchTotal = parseInt(frenchMatch[1]);
    analysis.frenchSuccess = parseInt(frenchMatch[2]);
    analysis.frenchRate = analysis.frenchTotal > 0 
      ? (analysis.frenchSuccess / analysis.frenchTotal) * 100 
      : 0;
  }
  
  // Parse English stats
  const englishMatch = content.match(/ENGLISH QUESTIONS[\s\S]*?Total: (\d+)[\s\S]*?Success: (\d+)/);
  if (englishMatch) {
    analysis.englishTotal = parseInt(englishMatch[1]);
    analysis.englishSuccess = parseInt(englishMatch[2]);
    analysis.englishRate = analysis.englishTotal > 0 
      ? (analysis.englishSuccess / analysis.englishTotal) * 100 
      : 0;
  }
  
  // Parse category breakdown
  const categorySection = content.match(/CATEGORY BREAKDOWN[\s\S]*?PROVIDER BREAKDOWN/);
  if (categorySection) {
    const categoryLines = categorySection[0].split('\n').filter(l => l.includes(':') && l.includes('/'));
    categoryLines.forEach(line => {
      const match = line.match(/(\w+): (\d+)\/(\d+) \(([\d.]+)%\)/);
      if (match) {
        const [, category, success, total, rate] = match;
        analysis.categoryBreakdown.set(category, {
          success: parseInt(success),
          total: parseInt(total),
          rate: parseFloat(rate)
        });
      }
    });
  }
  
  // Identify issues
  if (analysis.successRate < 50) {
    analysis.issues.push(`Overall success rate is low (${analysis.successRate.toFixed(1)}%)`);
  }
  
  analysis.categoryBreakdown.forEach((stats, category) => {
    if (stats.rate < 30 && stats.total >= 5) {
      analysis.issues.push(`${category} category has very low success rate (${stats.rate.toFixed(1)}% - ${stats.success}/${stats.total})`);
    }
  });
  
  // Generate recommendations
  if (analysis.successRate < 50) {
    analysis.recommendations.push('Consider improving similarity matching for better chunk retrieval');
    analysis.recommendations.push('Review classification logic - may be filtering out relevant chunks');
    analysis.recommendations.push('Check if database contains information for failing categories');
  }
  
  const failingCategories = Array.from(analysis.categoryBreakdown.entries())
    .filter(([_, stats]) => stats.rate < 30 && stats.total >= 5)
    .map(([cat, _]) => cat);
  
  if (failingCategories.length > 0) {
    analysis.recommendations.push(`Categories needing attention: ${failingCategories.join(', ')}`);
    analysis.recommendations.push('Consider adding more documents or improving keyword matching for these categories');
  }
  
  return analysis;
}

function printAnalysis(analysis: Analysis) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST RESULTS ANALYSIS');
  console.log('='.repeat(80) + '\n');
  
  console.log('📊 OVERALL STATISTICS');
  console.log(`   Total Questions: ${analysis.totalQuestions}`);
  console.log(`   Success Rate: ${analysis.successRate.toFixed(1)}% (${analysis.totalSuccess}/${analysis.totalQuestions})`);
  console.log(`   Failure Rate: ${(100 - analysis.successRate).toFixed(1)}% (${analysis.totalFailed}/${analysis.totalQuestions})\n`);
  
  console.log('🌍 LANGUAGE BREAKDOWN');
  console.log(`   French: ${analysis.frenchRate.toFixed(1)}% (${analysis.frenchSuccess}/${analysis.frenchTotal})`);
  console.log(`   English: ${analysis.englishRate.toFixed(1)}% (${analysis.englishSuccess}/${analysis.englishTotal})\n`);
  
  console.log('📋 CATEGORY PERFORMANCE');
  const sortedCategories = Array.from(analysis.categoryBreakdown.entries())
    .sort((a, b) => a[1].rate - b[1].rate);
  
  sortedCategories.forEach(([category, stats]) => {
    const emoji = stats.rate >= 70 ? '✅' : stats.rate >= 40 ? '⚠️' : '❌';
    console.log(`   ${emoji} ${category}: ${stats.rate.toFixed(1)}% (${stats.success}/${stats.total})`);
  });
  
  console.log('\n🔍 KEY ISSUES');
  if (analysis.issues.length === 0) {
    console.log('   ✅ No major issues detected');
  } else {
    analysis.issues.forEach(issue => {
      console.log(`   ⚠️  ${issue}`);
    });
  }
  
  console.log('\n💡 RECOMMENDATIONS');
  if (analysis.recommendations.length === 0) {
    console.log('   ✅ System is performing well');
  } else {
    analysis.recommendations.forEach(rec => {
      console.log(`   💡 ${rec}`);
    });
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Main
const reportFile = process.argv[2] || 'scripts/test-report-1770573539600.txt';
const reportPath = path.isAbsolute(reportFile) ? reportFile : path.join(process.cwd(), reportFile);

if (!fs.existsSync(reportPath)) {
  console.error(`❌ Report file not found: ${reportPath}`);
  process.exit(1);
}

const analysis = analyzeReport(reportPath);
printAnalysis(analysis);
