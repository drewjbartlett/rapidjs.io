<pre><code class="language-js">var tag = new Rapid({ modelName: 'Tag' });

tag.id(45).withParam('name', 'hiking').put().then(function (response) {
    // PUT => /api/tag/45
});
</code></pre>
