import type { MavenLibraryName } from "#common/schema/maven.ts";


export function isLWJGL3(name: MavenLibraryName) {
	return name.groupID === "org.lwjgl";
}

export function isLWJGL2(name: MavenLibraryName) {
	return name.groupID === "org.lwjgl.lwjgl";
}

/**
 * Is it an indirect dependency from LWJGL 2?
 * @param name Library name
 * @returns true for jinput and -> jutils - libraries which Minecraft does not require directly but LWJGL does
 */
export function isLWJGL2Dependency(name: MavenLibraryName) {
	return name.groupID === "net.java.jinput" || name.groupID === "net.java.jutils";
}

export function resolveMavenLibrary(base: string, name: MavenLibraryName, extension: string) {
	const group = encodeURIComponent(name.groupID).replace(".", "/");
	const artifact = encodeURIComponent(name.artifactID);
	const version = encodeURIComponent(name.version);
	const classifier = name.classifier ? "-" + encodeURIComponent(name.classifier) : "";
	const suffix = "." + encodeURIComponent(extension);

	return new URL(`${group}/${artifact}/${version}/${artifact}-${version}${classifier}${suffix}`, base);
}
