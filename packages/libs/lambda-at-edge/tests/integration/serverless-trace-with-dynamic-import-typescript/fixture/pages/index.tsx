import dynamic from "next/dynamic";
import * as React from "react";

const DynamicComponent = dynamic(() => import("../components/hello"));

const Page = () => <DynamicComponent />;

Page.getInitialProps = () => {
  // just forcing this page to be server side rendered
  return {
    foo: "bar"
  };
};

export default Page;
