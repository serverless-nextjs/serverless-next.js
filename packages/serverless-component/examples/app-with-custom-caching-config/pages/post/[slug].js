import { useRouter } from "next/router";

export default () => {
  const router = useRouter();
  const { slug } = router.query;

  return <div>Blog post updated: {slug}</div>;
};
