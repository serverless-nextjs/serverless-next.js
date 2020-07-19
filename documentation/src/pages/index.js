import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

const features = [
  {
    title: <>Zero configuration by default</>,
    imageUrl: 'img/configuration.svg',
    description: (
      <>
        There is no configuration needed. You can extend defaults based on your application needs.
      </>
    ),
  },
  {
    title: <>Feature parity with NextJS</>,
    imageUrl: 'img/nextjs.svg',
    description: (
      <>
        Users of this component should be able to use nextjs development 
        tooling, aka next dev. It is the component's job to deploy your 
        application ensuring parity with all of next's features we know and love.
      </>
    ),
  },
  {
    title: <>Fast deployments. No CloudFormation resource limits</>,
    imageUrl: 'img/cloud.svg',
    description: (
      <>
        With a simplified architecture and no use of CloudFormation, there are 
        no limits to how many pages you can have in your application, plus 
        deployment times are very fast!
      </>
    ),
  },
];

function Feature({imageUrl, title, description}) {
  const imgUrl = useBaseUrl(imageUrl);
  return (
    <div className={clsx('col col--4', styles.feature)}>
      {imgUrl && (
        <div className="text--center">
          <img className={styles.featureImage} src={imgUrl} alt={title} />
        </div>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function Home() {
  const context = useDocusaurusContext();
  const {siteConfig = {}} = context;
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">

      {/** HERO */}
      <header className={clsx('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          {/* <img className={styles.mainLogo} src="img/logo.svg" alt="Serverless Nextjs component"/> */}
          <h1 className="hero__title">{siteConfig.title}</h1>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link
              className={clsx(
                'button button--outline button--secondary button--lg',
                styles.getStarted,
              )}
              to={useBaseUrl('docs/installation/')}>
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/** FEATURES */}
      <main className={styles.sectionBanner}>
        {features && features.length > 0 && (
          <section className={styles.features}>
            <div className="container">
              <div className="row">
                {features.map((props, idx) => (
                  <Feature key={idx} {...props} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/** ARCHITECTURE */}
      <main className={styles.sectionBanner}>
          <div className="container">
            <div class="row">
              <div class="col col--4" style={{textAlign: 'left'}}>
                <h1>Architecture</h1>
                <p>
                  Pure Serverless architecture that is fast and cost effective. 
                  Four Cache Behaviours are created in CloudFront.
                </p>
                <Link
                  className={clsx(
                    'button button--outline button--secondary button--lg',
                    styles.getStarted,
                  )}
                  to={useBaseUrl('docs/architecture')}>
                  Read More
                </Link>
              </div>
              <div class="col col--8" >
                  <img src="img/arch_no_grid.svg" alt="Architecture" className={styles.architectureImg}/>
              </div>
            </div>
          </div>
      </main>
      
      {/** SUPPORT/SPONSOR */}
      <main className={styles.sectionBanner}>
          <div className="container">
            <h1>Organizations</h1>
            <p>Support this project with your organization. Your logo will show up here with a link to your website</p>
          </div>
      </main>
    </Layout>
  );
}

export default Home;
