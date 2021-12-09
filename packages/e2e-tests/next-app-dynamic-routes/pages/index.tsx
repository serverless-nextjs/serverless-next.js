import React from "react";
import { NextPageContext } from "next";

type IndexPageProps = {
  name: string;
};

export default function IndexPage(props: IndexPageProps): JSX.Element {
  return (
    <React.Fragment>
      <div>
        {`Hello ${props.name}. This is an SSR page using getServerSideProps(). It also has an image.`}
      </div>
      <img src={"/app-store-badge.png"} alt={"An image"} />
    </React.Fragment>
  );
}

export async function getServerSideProps(
  ctx: NextPageContext
): Promise<{ props: IndexPageProps }> {
  return {
    props: { name: "serverless-next.js" }
  };
}
