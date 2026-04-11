class Gitxplain < Formula
  desc "AI-powered Git commit explainer CLI"
  homepage "https://github.com/guruswarupa/gitxplain"
  url "https://registry.npmjs.org/gitxplain/-/gitxplain-0.1.9.tgz"
  sha256 "<SHA256_PLACEHOLDER>"
  license "MIT"

  depends_on "node"

  def install
    libexec.install Dir["package/*"]
    bin.install_symlink libexec/"cli/index.js" => "gitxplain"
    bin.install_symlink libexec/"cli/index.js" => "gitxplore"
  end

  test do
    assert_match "gitxplain", shell_output("#{bin}/gitxplain --help")
  end
end
