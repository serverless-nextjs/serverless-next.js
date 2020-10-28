import React from "react";
import { NextPageContext } from "next";

type CatchAllPageProps = {
  name: string;
};

export default function CatchAllPage(props: CatchAllPageProps): JSX.Element {
  return (
    <React.Fragment>
      <div>
        {`Hello ${props.name}. This is catch-all-ssr, a catch-all SSR page using getServerSideProps(). It also has an image.`}
      </div>
      <img src={"/app-store-badge.png"} alt={"An image"} />
    </React.Fragment>
  );
}

export async function getServerSideProps(
  ctx: NextPageContext
): Promise<{ props: CatchAllPageProps }> {
  return {
    props: { name: "serverless-next.js" }
  };
}
