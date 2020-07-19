module.exports = {
  title: 'Serverless Nextjs Component',
  tagline: 'A zero configuration Nextjs 9.0 serverless component with full feature parity',
  url: 'https://your-docusaurus-test-site.com',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'serverless-nextjs', // Usually your GitHub org/user name.
  projectName: 'Serverless NextJS Component', // Usually your repo name.
  themeConfig: {
    disableDarkMode: true,
    sidebarCollapsible: false,
    announcementBar: {
      id: 'work_in_progress', // Any value that will identify this message.
      content:
        'Alpha Release v1.0.0',
      backgroundColor: 'yellow', // Defaults to `#fff`.
      textColor: '#091E42', // Defaults to `#000`.
    },
    navbar: {
      title: 'Serverless-Nextjs',
      logo: {
        alt: 'Serverless Nextjs component',
        src: 'img/logo.svg',
      },
      links: [
        {
          to: 'docs/',
          activeBasePath: 'docs',
          label: 'Docs',
          position: 'left',
        },
        {to: 'blog', label: 'Blog', position: 'left'},
        // {to: 'motivation', label: 'Motivation', position: 'left'},
        {
          href: 'https://github.com/serverless-nextjs/serverless-next.js',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-component/examples',
          label: 'Examples',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: 'docs/installation/',
            },
            {
              label: 'FAQs',
              to: 'docs/faq/',
            },
            {
              label: 'Contributing',
              to: '/docs/contributing/'
            }
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/docusaurus',
            },
            {
              label: 'Discord',
              href: 'https://discordapp.com/invite/docusaurus',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/docusaurus',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: 'blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/serverless-nextjs/serverless-next.js',
            },
            {
              label: 'Examples',
              href: 'https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-component/examples',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Serverless-Nextjs component.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          // It is recommended to set document id as docs home page (`docs/` path).
          homePageId: 'basics',
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/serverless-nextjs/serverless-next.js/documentation/docs/',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            'https://github.com/serverless-nextjs/serverless-next.js/documentation/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
