<pre><code class="language-js">var Category = new rapid({ modelName: 'Category' });

Category.id(45).withParam('name', 'featured').patch().then(function (response) {
    // PATCH => /api/tag/45
});
</code></pre>
