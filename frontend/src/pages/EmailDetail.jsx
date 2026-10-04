import { EmailViewer } from "../components/EmailViewer";
import { useParams } from "wouter";
import { Layout } from "../components/Layout";

export function EmailDetail({ id }) {
	const params = useParams();

	return (
		<Layout>
			<EmailViewer id={params.id} />
		</Layout>
	);
}
