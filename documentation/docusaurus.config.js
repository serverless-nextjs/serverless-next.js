module.exports = {
  title: "Serverless Nextjs",
  tagline:
    "A zero configuration Nextjs 9.0 serverless component with full feature parity",
  url: "https://serverless-nextjs.com",
  baseUrl: "/",
  favicon: "img/favicon.ico",
  organizationName: "serverless-nextjs",
  projectName: "Serverless NextJS",
  themeConfig: {
    disableDarkMode: true,
    sidebarCollapsible: false,
    announcementBar: {
      id: "work_in_progress", // Any value that will identify this message.
      content: "Alpha Release v1.0.0",
      backgroundColor: "yellow", // Defaults to `#fff`.
      textColor: "#091E42" // Defaults to `#000`.
    },
    navbar: {
      title: "Serverless Nextjs",
      logo: {
        alt: "Serverless Nextjs",
        src: "img/logo.svg"
      },
      links: [
        {
          to: "docs/",
          activeBasePath: "docs",
          label: "Docs",
          position: "left"
        },
        { to: "blog", label: "Blog", position: "left" },
        // {to: 'motivation', label: 'Motivation', position: 'left'},
        {
          href: "https://github.com/serverless-nextjs/serverless-next.js",
          label: "GitHub",
          position: "right"
        },
        {
          href:
            "https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-components/nextjs-component/examples",
          label: "Examples",
          position: "right"
        }
      ]
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Getting Started",
              to: "docs/installation/"
            },
            {
              label: "FAQs",
              to: "docs/faq/"
            },
            {
              label: "Contributing",
              to: "/docs/contributing/"
            }
          ]
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/serverless-nextjs/serverless-next.js"
            },
            {
              label: "Examples",
              href:
                "https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-components/nextjs-component/examples"
            }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} serverless nextjs`
    }
  },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          // It is recommended to set document id as docs home page (`docs/` path).
          homePageId: "basics",
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          editUrl:
            "https://github.com/serverless-nextjs/serverless-next.js/documentation/docs/"
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            "https://github.com/serverless-nextjs/serverless-next.js/documentation/blog/"
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css")
        }
      }
    ]
  ]
};
