# RealtyFlow Component Library

**Design System v1.0** | Component Reference Guide for all Claude Design Agents

---

## Overview

This document provides detailed specifications and code snippets for every reusable component in the RealtyFlow design system. Use this as your source of truth when building landing pages, creating ads, or designing UI elements.

---

## 📦 Buttons

### Button States & Variants

```html
<!-- Primary Button -->
<button class="btn btn-primary">Get Demo</button>
<button class="btn btn-primary btn-lg">Get Started Free</button>
<button class="btn btn-primary" disabled>Loading...</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Learn More</button>

<!-- Outline Button -->
<button class="btn btn-outline">Contact Us</button>

<!-- Icon Button -->
<button class="btn btn-icon"><span class="icon">→</span></button>

<!-- Button Group -->
<div class="btn-group">
  <button class="btn btn-primary">Yes</button>
  <button class="btn btn-outline">No</button>
</div>
```

### Button Styles

```css
/* Base Button */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 6px;
  font-family: Poppins, sans-serif;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 300ms ease-in-out;
  white-space: nowrap;
}

/* Primary Button */
.btn-primary {
  background: #2563EB;
  color: white;
}

.btn-primary:hover {
  background: #1D4ED8;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
}

/* Secondary Button */
.btn-secondary {
  background: #F1F5F9;
  color: #0F172A;
  border: 1px solid #E2E8F0;
}

.btn-secondary:hover {
  background: #E2E8F0;
  border-color: #CBD5E1;
}

/* Outline Button */
.btn-outline {
  background: transparent;
  color: #2563EB;
  border: 2px solid #2563EB;
}

.btn-outline:hover {
  background: #2563EB;
  color: white;
}

/* Button Sizes */
.btn-sm {
  padding: 8px 16px;
  font-size: 14px;
}

.btn-lg {
  padding: 16px 32px;
  font-size: 18px;
}

/* Disabled State */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Button Group */
.btn-group {
  display: flex;
  gap: 8px;
}

@media (max-width: 640px) {
  .btn {
    padding: 10px 16px;
    font-size: 14px;
  }
}
```

---

## 🎨 Cards

### Card Variations

```html
<!-- Basic Card -->
<div class="card">
  <h3 class="card-title">Feature Title</h3>
  <p class="card-description">Card description text goes here</p>
</div>

<!-- Card with Header & Footer -->
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Track Everything</h3>
    <span class="card-badge">Pro</span>
  </div>
  <div class="card-body">
    <p>Manage deals, clients, and properties seamlessly</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-sm btn-primary">Learn More</button>
  </div>
</div>

<!-- Metric Card -->
<div class="card card-metric">
  <span class="metric-label">Active Deals</span>
  <strong class="metric-value">2,435</strong>
  <span class="metric-change positive">+12% this month</span>
</div>

<!-- Image Card -->
<div class="card card-image">
  <img src="property.jpg" alt="Property" class="card-image-img" />
  <div class="card-body">
    <h3 class="card-title">₹45,00,000</h3>
    <p class="card-description">Premium 3BHK, Bandra Mumbai</p>
  </div>
</div>

<!-- Testimonial Card -->
<div class="card card-testimonial">
  <div class="stars">⭐⭐⭐⭐⭐</div>
  <p class="testimonial-text">"RealtyFlow transformed how I manage my deals. Simple, effective, life-changing!"</p>
  <div class="testimonial-author">
    <strong>Rajesh Kumar</strong>
    <span>Real Estate Agent, Mumbai</span>
  </div>
</div>
```

### Card Styles

```css
/* Base Card */
.card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  transition: all 300ms ease-in-out;
}

.card:hover {
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
  border-color: #CBD5E1;
}

/* Card Sections */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #E2E8F0;
}

.card-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0F172A;
  font-family: Poppins, sans-serif;
}

.card-body {
  margin: 0 0 16px 0;
}

.card-description {
  margin: 0;
  font-size: 14px;
  color: #475569;
  line-height: 1.6;
}

.card-footer {
  padding-top: 16px;
  border-top: 1px solid #E2E8F0;
  display: flex;
  gap: 8px;
}

/* Card Badge */
.card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  background: #D1FAE5;
  color: #065F46;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

/* Metric Card */
.card-metric {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
}

.metric-label {
  font-size: 14px;
  color: #475569;
  font-weight: 500;
}

.metric-value {
  font-size: 32px;
  color: #0F172A;
  font-weight: 800;
  line-height: 1.2;
}

.metric-change {
  font-size: 12px;
  font-weight: 600;
}

.metric-change.positive {
  color: #22C55E;
}

.metric-change.negative {
  color: #EF4444;
}

/* Image Card */
.card-image {
  padding: 0;
  overflow: hidden;
}

.card-image-img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}

.card-image .card-body {
  padding: 16px;
}

/* Testimonial Card */
.card-testimonial {
  text-align: center;
}

.stars {
  font-size: 20px;
  margin-bottom: 16px;
}

.testimonial-text {
  font-size: 16px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 16px;
  font-style: italic;
}

.testimonial-author {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.testimonial-author strong {
  color: #0F172A;
  font-size: 14px;
}

.testimonial-author span {
  color: #64748B;
  font-size: 12px;
}

@media (max-width: 640px) {
  .card {
    padding: 16px;
  }

  .card-title {
    font-size: 18px;
  }

  .metric-value {
    font-size: 24px;
  }
}
```

---

## 📊 Metrics & Stats

### Metric Components

```html
<!-- Simple Metric -->
<div class="metric">
  <span class="metric-label">Total Deals Closed</span>
  <strong class="metric-value">₹2.5 Cr</strong>
</div>

<!-- Metric with Growth -->
<div class="metric">
  <span class="metric-label">New Leads This Month</span>
  <strong class="metric-value">142</strong>
  <span class="metric-change positive">↑ 23% vs last month</span>
</div>

<!-- Metric Grid -->
<div class="metrics-grid">
  <div class="metric">
    <span class="metric-label">Active Deals</span>
    <strong class="metric-value">24</strong>
  </div>
  <div class="metric">
    <span class="metric-label">Conversion Rate</span>
    <strong class="metric-value">34%</strong>
  </div>
  <div class="metric">
    <span class="metric-label">Avg Deal Size</span>
    <strong class="metric-value">₹1.2 Cr</strong>
  </div>
</div>
```

### Metric Styles

```css
.metric {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #F8FAFC;
  border-radius: 10px;
  text-align: center;
}

.metric-label {
  font-size: 14px;
  color: #475569;
  font-weight: 500;
}

.metric-value {
  font-size: 32px;
  color: #0F172A;
  font-weight: 800;
  line-height: 1;
}

.metric-change {
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
}

.metric-change.positive {
  color: #22C55E;
}

.metric-change.negative {
  color: #EF4444;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

@media (max-width: 640px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .metric-value {
    font-size: 24px;
  }
}
```

---

## 📋 Tables

### Table Components

```html
<table class="table">
  <thead>
    <tr>
      <th>Client Name</th>
      <th>Property</th>
      <th>Status</th>
      <th>Amount</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Arjun Kumar</strong></td>
      <td>3BHK, Bandra</td>
      <td><span class="badge badge-success">Active</span></td>
      <td>₹45,00,000</td>
      <td><button class="btn btn-sm btn-outline">View</button></td>
    </tr>
    <tr>
      <td><strong>Priya Sharma</strong></td>
      <td>2BHK, Andheri</td>
      <td><span class="badge badge-warning">Negotiating</span></td>
      <td>₹32,00,000</td>
      <td><button class="btn btn-sm btn-outline">View</button></td>
    </tr>
  </tbody>
</table>

<!-- Responsive Table -->
<div class="table-responsive">
  <table class="table">
    <!-- table content -->
  </table>
</div>
```

### Table Styles

```css
.table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.table thead {
  background: #F1F5F9;
  border-bottom: 2px solid #E2E8F0;
}

.table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: #0F172A;
  font-family: Poppins, sans-serif;
}

.table td {
  padding: 16px;
  border-bottom: 1px solid #E2E8F0;
  color: #475569;
  font-size: 14px;
}

.table tbody tr:hover {
  background: #F8FAFC;
  transition: background 150ms ease-in-out;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

/* Badges in Tables */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  background: #D1FAE5;
  color: #065F46;
}

.badge-warning {
  background: #FEF3C7;
  color: #92400E;
}

.badge-danger {
  background: #FEE2E2;
  color: #991B1B;
}

.badge-info {
  background: #DBEAFE;
  color: #0C4A6E;
}

/* Responsive Table */
.table-responsive {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  .table th,
  .table td {
    padding: 12px;
    font-size: 12px;
  }

  .table th {
    padding: 12px;
  }
}
```

---

## 🔤 Typography & Headings

### Text Components

```html
<!-- Heading Levels -->
<h1 class="h1">Apne Real Estate Business Ko Next Level Le Jaao</h1>
<h2 class="h2">Key Features That Drive Results</h2>
<h3 class="h3">Track Everything Seamlessly</h3>

<!-- Body Text -->
<p class="body">Standard paragraph text with regular line height</p>
<p class="body-large">Larger body text for emphasis</p>

<!-- Secondary Text -->
<p class="text-secondary">Secondary text for descriptions and meta information</p>

<!-- Text Utilities -->
<span class="text-accent">Growth metric</span>
<span class="text-success">Success state</span>
<span class="text-warning">Warning state</span>
<span class="text-danger">Error state</span>
```

### Typography Styles

```css
h1, .h1 {
  font-size: 48px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.5px;
  color: #0F172A;
  font-family: Poppins, sans-serif;
  margin: 0 0 16px 0;
}

h2, .h2 {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.25px;
  color: #0F172A;
  font-family: Poppins, sans-serif;
  margin: 0 0 12px 0;
}

h3, .h3 {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  color: #0F172A;
  font-family: Poppins, sans-serif;
  margin: 0 0 8px 0;
}

p, .body {
  font-size: 16px;
  line-height: 1.5;
  color: #475569;
  font-family: Inter, sans-serif;
  margin: 0 0 16px 0;
}

.body-large {
  font-size: 18px;
  line-height: 1.6;
  color: #475569;
}

.text-secondary {
  color: #64748B;
  font-size: 14px;
}

.text-accent {
  color: #2563EB;
  font-weight: 600;
}

.text-success {
  color: #22C55E;
  font-weight: 600;
}

.text-warning {
  color: #EAB308;
  font-weight: 600;
}

.text-danger {
  color: #EF4444;
  font-weight: 600;
}

@media (max-width: 640px) {
  h1, .h1 {
    font-size: 32px;
  }

  h2, .h2 {
    font-size: 24px;
  }

  h3, .h3 {
    font-size: 18px;
  }

  p, .body {
    font-size: 14px;
  }
}
```

---

## 📝 Form Components

### Form Elements

```html
<div class="form-group">
  <label class="form-label">Email Address</label>
  <input type="email" class="form-input" placeholder="your@email.com" />
  <span class="form-help">We'll never spam you</span>
</div>

<div class="form-group">
  <label class="form-label">Message</label>
  <textarea class="form-input form-textarea" placeholder="Your message here..." rows="4"></textarea>
</div>

<div class="form-group">
  <label class="form-checkbox">
    <input type="checkbox" />
    <span>I agree to the terms and conditions</span>
  </label>
</div>

<div class="form-group">
  <label class="form-label">Property Type</label>
  <select class="form-input form-select">
    <option>Select property type</option>
    <option>Apartment</option>
    <option>Villa</option>
    <option>Commercial</option>
  </select>
</div>

<div class="form-group">
  <button type="submit" class="btn btn-primary btn-block">Submit</button>
</div>
```

### Form Styles

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #0F172A;
}

.form-input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  font-family: Inter, sans-serif;
  font-size: 16px;
  color: #0F172A;
  transition: all 150ms ease-in-out;
}

.form-input:focus {
  outline: none;
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-input:disabled {
  background: #F1F5F9;
  cursor: not-allowed;
  opacity: 0.6;
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23475569' d='M0 0l6 8 6-8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.form-help {
  font-size: 12px;
  color: #64748B;
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.form-checkbox input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #2563EB;
}

.form-checkbox span {
  font-size: 14px;
  color: #475569;
}

.btn-block {
  width: 100%;
}

@media (max-width: 640px) {
  .form-input {
    padding: 10px 12px;
    font-size: 16px;
  }
}
```

---

## 🎯 CTA Sections

### Call-to-Action Components

```html
<!-- Standard CTA -->
<section class="cta-section">
  <div class="cta-content">
    <h2 class="cta-title">Ready to Transform Your Real Estate Business?</h2>
    <p class="cta-subtitle">Join 500+ agents already closing deals faster with RealtyFlow</p>
    <button class="btn btn-primary btn-lg">Get Started Free Today</button>
  </div>
</section>

<!-- Two-Column CTA -->
<section class="cta-section cta-split">
  <div class="cta-content">
    <h3>For Real Estate Agents</h3>
    <p>Track deals, manage clients, close faster</p>
    <button class="btn btn-primary">Agent Demo</button>
  </div>
  <div class="cta-content">
    <h3>For Property Developers</h3>
    <p>Manage projects, track sales, monitor inventory</p>
    <button class="btn btn-secondary">Developer Demo</button>
  </div>
</section>
```

### CTA Styles

```css
.cta-section {
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  color: white;
  padding: 80px 40px;
  border-radius: 14px;
  text-align: center;
}

.cta-title {
  font-size: 36px;
  font-weight: 800;
  margin-bottom: 16px;
  color: white;
}

.cta-subtitle {
  font-size: 18px;
  margin-bottom: 32px;
  color: #E2E8F0;
  line-height: 1.6;
}

.cta-section .btn-primary {
  background: #2563EB;
}

.cta-section .btn-primary:hover {
  background: #1D4ED8;
}

/* Split CTA */
.cta-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  text-align: left;
}

.cta-split .cta-content {
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@media (max-width: 1024px) {
  .cta-split {
    grid-template-columns: 1fr;
  }

  .cta-section {
    padding: 60px 30px;
  }

  .cta-title {
    font-size: 28px;
  }

  .cta-subtitle {
    font-size: 16px;
  }
}
```

---

## 🔗 Navigation & Layout

### Navigation Components

```html
<!-- Header Navigation -->
<header class="navbar">
  <div class="navbar-container">
    <div class="navbar-logo">RealtyFlow</div>
    <nav class="navbar-menu">
      <a href="#features" class="navbar-link">Features</a>
      <a href="#pricing" class="navbar-link">Pricing</a>
      <a href="#about" class="navbar-link">About</a>
      <button class="btn btn-sm btn-primary">Get Demo</button>
    </nav>
  </div>
</header>

<!-- Footer -->
<footer class="footer">
  <div class="footer-content">
    <div class="footer-section">
      <h4>RealtyFlow</h4>
      <p>Empower your real estate business</p>
    </div>
    <div class="footer-section">
      <h4>Links</h4>
      <a href="#">Features</a>
      <a href="#">Pricing</a>
      <a href="#">Blog</a>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; 2026 RealtyFlow. All rights reserved.</p>
  </div>
</footer>
```

### Navigation Styles

```css
.navbar {
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: 100;
}

.navbar-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navbar-logo {
  font-size: 20px;
  font-weight: 800;
  color: #0F172A;
  text-decoration: none;
}

.navbar-menu {
  display: flex;
  align-items: center;
  gap: 24px;
}

.navbar-link {
  color: #475569;
  text-decoration: none;
  font-weight: 500;
  transition: color 150ms ease-in-out;
}

.navbar-link:hover {
  color: #2563EB;
}

/* Footer */
.footer {
  background: #0F172A;
  color: #E2E8F0;
  padding: 60px 40px 20px;
}

.footer-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 40px;
  max-width: 1280px;
  margin: 0 auto 40px;
}

.footer-section h4 {
  color: white;
  margin-bottom: 12px;
}

.footer-section a {
  display: block;
  color: #CBD5E1;
  text-decoration: none;
  margin-bottom: 8px;
  transition: color 150ms ease-in-out;
}

.footer-section a:hover {
  color: #2563EB;
}

.footer-bottom {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #64748B;
}

@media (max-width: 640px) {
  .navbar-menu {
    gap: 12px;
  }

  .navbar-link {
    font-size: 14px;
  }
}
```

---

## 📐 Layout Utilities

### Common Grid & Layout Patterns

```css
/* Container */
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 40px;
}

@media (max-width: 1024px) {
  .container {
    padding: 0 30px;
  }
}

@media (max-width: 640px) {
  .container {
    padding: 0 20px;
  }
}

/* Grid Systems */
.grid {
  display: grid;
  gap: 24px;
}

.grid-2 {
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.grid-3 {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.grid-4 {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

/* Flex Utilities */
.flex {
  display: flex;
}

.flex-center {
  align-items: center;
  justify-content: center;
}

.flex-between {
  justify-content: space-between;
}

.flex-gap-md {
  gap: 16px;
}

.flex-gap-lg {
  gap: 24px;
}

/* Spacing Utilities */
.py-xl {
  padding: 80px 0;
}

.py-lg {
  padding: 40px 0;
}

.py-md {
  padding: 24px 0;
}

.mt-lg {
  margin-top: 40px;
}

.mb-lg {
  margin-bottom: 40px;
}

/* Text Alignment */
.text-center {
  text-align: center;
}

.text-left {
  text-align: left;
}

.text-right {
  text-align: right;
}
```

---

## ✅ Usage Examples

### Landing Page Hero Section

```html
<section class="hero">
  <div class="container">
    <div class="grid grid-2">
      <div>
        <h1 class="h1">Apne Deals Ko Track Karo, Faster Close Karo</h1>
        <p class="body-large">Real estate agents ke liye built. Simple, powerful, effective.</p>
        <button class="btn btn-primary btn-lg">Get Started Free</button>
      </div>
      <div>
        <img src="hero-image.jpg" alt="Hero" style="width: 100%; border-radius: 14px;" />
      </div>
    </div>
  </div>
</section>
```

### Feature Grid Section

```html
<section class="py-xl">
  <div class="container">
    <h2 class="h2 text-center">Key Features</h2>
    <div class="grid grid-3" style="margin-top: 40px;">
      <div class="card">
        <h3 class="h3">🎯 Track Deals</h3>
        <p class="card-description">Never lose track of your pipeline again</p>
      </div>
      <div class="card">
        <h3 class="h3">📞 Manage Leads</h3>
        <p class="card-description">Organize and follow up with every lead</p>
      </div>
      <div class="card">
        <h3 class="h3">⚡ Close Faster</h3>
        <p class="card-description">Reduce cycle time and increase conversion</p>
      </div>
    </div>
  </div>
</section>
```

---

**Component Library v1.0** | Last Updated: May 3, 2026 | Status: Production Ready
