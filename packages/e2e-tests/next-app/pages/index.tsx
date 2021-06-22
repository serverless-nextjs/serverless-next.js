import React from "react";

type IndexPageProps = {
  name: string;
};

export default function IndexPage(props: IndexPageProps): JSX.Element {
  return (
    <React.Fragment>
      <div>
        {`Hello ${props.name}. This is an SSG page using getStaticProps(). It also has an image.`}
      </div>
      <img src={"/app-store-badge.png"} alt={"An image"} />
    </React.Fragment>
  );
}

export function getStaticProps(): { props: IndexPageProps } {
  return {
    props: { name: "serverless-next.js" }
  };
}
