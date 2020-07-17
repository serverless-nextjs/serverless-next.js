/** 
 * Not used right now.
 * You can create a React component based page
 * Or you can create a Page as a .md file inside docs
*/

import React from 'react';
import Layout from '@theme/Layout';
import styles from './styles.module.css';

function Motivation() {
  return (
    <Layout title="Hello">
      <div className={`container ${styles.motivationContainer}`}>
          <h1>Motivation</h1>
          <p>
            Since Nextjs 8.0, serverless mode was introduced which provides a new low 
            level API which projects like this can use to deploy onto different cloud 
            providers. This project is a better version of the serverless plugin which 
            focuses on addressing core issues like next 9 support, better development 
            experience, the 200 CloudFormation resource limit and performance.
          </p>
      </div>
    </Layout>
  );
}

export default Motivation;