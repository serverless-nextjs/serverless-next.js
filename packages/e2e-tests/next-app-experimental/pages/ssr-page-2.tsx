import React from "react";

type SsrPage2Props = {
  name: string;
};

export default function SsrPage2(props: SsrPage2Props): JSX.Element {
  return (
    <React.Fragment>
      <div>
        {`Hello ${props.name}. This is an SSR page using getServerSideProps(). It also has an image.`}
      </div>
      <img src={"/app-store-badge.png"} alt={"An image"} />
    </React.Fragment>
  );
}

export function getServerSideProps(): { props: SsrPage2Props } {
  return {
    props: { name: "serverless-next.js" }
  };
}
